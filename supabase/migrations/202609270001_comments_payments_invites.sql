begin;

create table public.project_comments (
 id uuid primary key, project_id uuid not null references public.projects(id),
 item_id uuid, author_id uuid not null references auth.users(id),
 body text not null default '' check(length(body)<=4000),
 attachments jsonb not null default '[]' check(jsonb_typeof(attachments)='array' and jsonb_array_length(attachments)<=10),
 created_at timestamptz not null default now(),
 foreign key(item_id,project_id) references public.project_items(id,project_id),
 check(length(btrim(body))>0 or jsonb_array_length(attachments)>0)
);
create index project_comments_project on public.project_comments(project_id,created_at);
create table public.payment_notices (
 id uuid primary key, project_id uuid not null references public.projects(id),
 author_id uuid not null references auth.users(id),
 amount numeric(12,2) not null check(amount>0),
 note text not null default '' check(length(note)<=2000),
 attachments jsonb not null default '[]' check(jsonb_typeof(attachments)='array' and jsonb_array_length(attachments)<=10),
 created_at timestamptz not null default now(), confirmed_at timestamptz,
 payment_id uuid references public.project_payments(id)
);
create index payment_notices_project on public.payment_notices(project_id,created_at);
alter table public.project_comments enable row level security;
alter table public.payment_notices enable row level security;
revoke all on public.project_comments,public.payment_notices from anon,authenticated;
grant select on public.project_comments,public.payment_notices to authenticated;
create policy comments_read on public.project_comments for select to authenticated using(public.can_read_project(project_id));
create policy notices_read on public.payment_notices for select to authenticated using(public.can_read_project(project_id));

-- Attachments become immutable when a comment or notice refers to them.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('project-attachments','project-attachments',false,104857600,array['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/webm','video/quicktime','application/pdf','text/plain','application/zip','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']) on conflict(id) do nothing;
create function public.project_attachment_read(p_path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.project_comments c where public.can_read_project(c.project_id) and c.attachments @> jsonb_build_array(jsonb_build_object('path',p_path)))
 or exists(select 1 from public.payment_notices n where public.can_read_project(n.project_id) and n.attachments @> jsonb_build_array(jsonb_build_object('path',p_path)))
$$;
create policy attachment_read on storage.objects for select to authenticated using(bucket_id='project-attachments' and public.project_attachment_read(name));
create policy attachment_upload on storage.objects for insert to authenticated with check(bucket_id='project-attachments' and (storage.foldername(name))[2]=auth.uid()::text and exists(select 1 from public.projects p where p.id::text=(storage.foldername(storage.objects.name))[1] and public.can_read_project(p.id)));
-- No update/delete policy: neither participant can replace evidence.
create function public.validate_project_attachments(p_project uuid,p_id uuid,p_files jsonb) returns void language plpgsql security definer set search_path='' as $$
declare f jsonb; begin
 if p_files is null or jsonb_typeof(p_files)<>'array' or jsonb_array_length(p_files)>10 then raise exception 'Додайте до 10 файлів.'; end if;
 for f in select jsonb_array_elements(p_files) loop
  if jsonb_typeof(f)<>'object' or coalesce(length(f->>'name'),0) not between 1 and 255
   or coalesce(f->>'path','') not like p_project::text||'/'||auth.uid()::text||'/'||p_id::text||'/%'
   or f->>'path' like '%..%' or not exists(select 1 from storage.objects where bucket_id='project-attachments' and name=f->>'path') then raise exception 'Вкладення недоступне. Завантажте файл повторно.'; end if;
 end loop;
end $$;
create function public.collaboration_detail(p_project_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.can_read_project(p_project_id) then raise exception 'Проєкт недоступний.' using errcode='42501'; end if;
 return jsonb_build_object(
 'project_version',(select version from public.projects where id=p_project_id),
 'has_client',exists(select 1 from public.project_members where project_id=p_project_id),
 'comments',coalesce((select jsonb_agg(to_jsonb(c) order by created_at,id) from public.project_comments c where project_id=p_project_id),'[]'::jsonb),
 'notices',coalesce((select jsonb_agg(to_jsonb(n) order by created_at desc,id) from public.payment_notices n where project_id=p_project_id),'[]'::jsonb),
 'events',coalesce((select jsonb_agg(to_jsonb(e) order by recorded_at desc,id) from public.project_events e where project_id=p_project_id and action in ('payment','void_payment','payment_notice','confirm_payment_notice','approve','request_approval','request_changes','confirm_report','return_report','submit_report','revise','finish')),'[]'::jsonb));
end $$;
create function public.collaboration_action(p_project_id uuid,p_action text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.projects%rowtype; n public.payment_notices%rowtype; c public.project_comments%rowtype;
 rid uuid:=(p_payload->>'id')::uuid; files jsonb:=coalesce(p_payload->'attachments','[]'::jsonb); amount numeric; result jsonb; receipt uuid; previous_receipts uuid[];
begin
 select * into p from public.projects where id=p_project_id for update;
 if not found or not public.can_read_project(p.id) then raise exception 'Проєкт недоступний.' using errcode='42501'; end if;
 if rid is null then raise exception 'Відсутній ідентифікатор запиту.'; end if;
 if p_action='comment' then
  select * into c from public.project_comments where id=rid;
  if found then
   if c.project_id<>p.id or c.author_id<>auth.uid() or c.body<>coalesce(p_payload->>'body','') or c.item_id is distinct from (p_payload->>'item_id')::uuid or c.attachments<>files then raise exception 'Ідентифікатор уже використаний.'; end if;
   return public.collaboration_detail(p.id);
  end if;
  perform public.validate_project_attachments(p.id,rid,files);
  insert into public.project_comments(id,project_id,item_id,author_id,body,attachments) values(rid,p.id,(p_payload->>'item_id')::uuid,auth.uid(),coalesce(p_payload->>'body',''),files);
 elsif p_action='payment_notice' then
  if not exists(select 1 from public.project_members where project_id=p.id and user_id=auth.uid()) then raise exception 'Повідомлення про переказ доступне замовнику.' using errcode='42501'; end if;
  amount:=(p_payload->>'amount')::numeric;
  if amount is null or amount<=0 or amount<>round(amount,2) then raise exception 'Вкажіть додатну суму з точністю до копійок.'; end if;
  select * into n from public.payment_notices where id=rid;
  if found then
   if n.project_id<>p.id or n.author_id<>auth.uid() or n.amount<>amount or n.note<>coalesce(p_payload->>'note','') or n.attachments<>files then raise exception 'Ідентифікатор уже використаний.'; end if;
   return public.collaboration_detail(p.id);
  end if;
  perform public.validate_project_attachments(p.id,rid,files);
  insert into public.payment_notices(id,project_id,author_id,amount,note,attachments) values(rid,p.id,auth.uid(),amount,coalesce(p_payload->>'note',''),files);
  insert into public.project_events(project_id,action,occurred_at,details) values(p.id,p_action,now(),jsonb_build_object('amount',amount,'note',p_payload->>'note','actor',auth.uid(),'notice_id',rid));
 elsif p_action='confirm_payment_notice' then
  if p.user_id<>auth.uid() then raise exception 'Оплату зараховує майстер.' using errcode='42501'; end if;
  select * into n from public.payment_notices where id=rid and project_id=p.id for update;
  if not found then raise exception 'Повідомлення не знайдено.'; end if;
  if n.confirmed_at is not null then return public.collaboration_detail(p.id); end if;
  select coalesce(array_agg(id),'{}'::uuid[]) into previous_receipts from public.project_payments where project_id=p.id;
  result:=public.project_mutate(p.id,'payment',jsonb_build_object('amount',n.amount,'note',left(n.note,500),'occurred_at',now(),'version',p.version),rid);
  select id into strict receipt from public.project_payments where project_id=p.id and not(id=any(previous_receipts));
  update public.payment_notices set confirmed_at=now(),payment_id=receipt where id=rid;
  insert into public.project_events(project_id,action,occurred_at,details) values(p.id,p_action,now(),jsonb_build_object('amount',n.amount,'actor',auth.uid(),'notice_id',rid,'payment_id',receipt));
 else raise exception 'Невідома дія.'; end if;
 return public.collaboration_detail(p.id);
end $$;

-- Invite identity is a verified account email, never editable profile metadata.
alter table public.project_invites add column recipient_email text;
update public.project_invites set revoked_at=now() where accepted_at is null and revoked_at is null;
alter function public.make_invite(uuid) rename to make_invite_unbound;
alter function public.accept_invite(uuid) rename to accept_invite_unbound;
revoke all on function public.make_invite_unbound(uuid),public.accept_invite_unbound(uuid) from public,anon,authenticated;
create function public.find_project_client(p_project_id uuid,p_email text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid; begin
 if not exists(select 1 from public.projects where id=p_project_id and user_id=auth.uid()) then raise exception 'Проєкт недоступний.' using errcode='42501'; end if;
 if p_email is null or length(btrim(p_email))>254 or btrim(p_email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Вкажіть повну електронну адресу.'; end if;
 select a.user_id into u from public.accounts a join auth.users u on u.id=a.user_id where a.role='CLIENT' and lower(u.email)=lower(btrim(p_email)) and u.email_confirmed_at is not null limit 1;
 return jsonb_build_object('found',u is not null);
end $$;
create function public.make_invite(p_project_id uuid,p_email text) returns uuid language plpgsql security definer set search_path='' as $$
declare t uuid; begin
 perform public.find_project_client(p_project_id,p_email);
 t:=public.make_invite_unbound(p_project_id);
 update public.project_invites set recipient_email=lower(btrim(p_email)) where token=t;
 return t;
end $$;
create function public.accept_invite(p_token uuid) returns uuid language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.project_invites i join auth.users u on u.id=auth.uid() where i.token=p_token and lower(u.email)=i.recipient_email and u.email_confirmed_at is not null) then raise exception 'Увійдіть через підтверджену пошту, на яку створене запрошення.' using errcode='42501'; end if;
 return public.accept_invite_unbound(p_token);
end $$;
create function public.pending_project_invites() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('token',i.token,'name',p.name,'expires_at',i.expires_at) order by i.created_at desc),'[]'::jsonb)
 from public.project_invites i join public.projects p on p.id=i.project_id join auth.users u on u.id=auth.uid()
 where lower(u.email)=i.recipient_email and u.email_confirmed_at is not null and i.accepted_at is null and i.revoked_at is null and i.expires_at>now()
$$;
revoke all on function public.project_attachment_read(text),public.validate_project_attachments(uuid,uuid,jsonb),public.collaboration_detail(uuid),public.collaboration_action(uuid,text,jsonb),public.find_project_client(uuid,text),public.make_invite(uuid,text),public.accept_invite(uuid),public.pending_project_invites() from public,anon,authenticated;
grant execute on function public.project_attachment_read(text),public.collaboration_detail(uuid),public.collaboration_action(uuid,text,jsonb),public.find_project_client(uuid,text),public.make_invite(uuid,text),public.accept_invite(uuid),public.pending_project_invites() to authenticated;
-- Live updates are hints only; all reads remain protected by project membership.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='projects') then alter publication supabase_realtime add table public.projects; end if;
  alter publication supabase_realtime add table public.project_comments,public.payment_notices;
 end if;
end $$;
commit;