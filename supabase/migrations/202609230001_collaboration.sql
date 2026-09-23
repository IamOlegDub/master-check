begin;

create table public.accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check(role in ('MASTER','CLIENT')),
 portfolio_token uuid not null default gen_random_uuid() unique,
 portfolio_public boolean not null default false,
 created_at timestamptz not null default now()
);
-- Existing users retain the master workspace; new users choose their role.
insert into public.accounts(user_id,role) select id,'MASTER' from auth.users;
alter table public.accounts enable row level security;
grant select on public.accounts to authenticated;
create policy accounts_self on public.accounts for select to authenticated using(user_id=auth.uid());
create function public.choose_role(p_role text) returns text language plpgsql security definer set search_path='' as $$
declare r text; begin
 if auth.uid() is null or p_role not in ('MASTER','CLIENT') then raise exception 'Оберіть роль після входу.'; end if;
 insert into public.accounts(user_id,role) values(auth.uid(),p_role) on conflict(user_id) do nothing;
 select role into r from public.accounts where user_id=auth.uid(); return r;
end $$;
create function public.is_master() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.accounts where user_id=auth.uid() and role='MASTER')$$;

create table public.clients (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 name text not null check(length(btrim(name)) between 1 and 160),
 phone text not null default '' check(length(phone)<=30), notes text not null default '' check(length(notes)<=2000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,user_id)
);
alter table public.clients enable row level security;
grant select,insert,delete on public.clients to authenticated;
grant update(name,phone,notes,updated_at) on public.clients to authenticated;
create policy own_clients on public.clients for all to authenticated using(user_id=auth.uid() and public.is_master()) with check(user_id=auth.uid() and public.is_master());

alter table public.projects drop constraint projects_status_check;
update public.projects set status=case status when 'Очікує старту' then 'DRAFT' when 'В роботі' then 'IN_PROGRESS' else 'COMPLETED' end;
alter table public.projects alter column status set default 'DRAFT';
alter table public.projects add constraint projects_status_check check(status in ('DRAFT','PENDING_APPROVAL','IN_PROGRESS','COMPLETED'));
alter table public.projects add column client_id uuid;
alter table public.projects add constraint projects_client_owner_fk foreign key(client_id,user_id) references public.clients(id,user_id);
alter table public.projects add column approved_at timestamptz;
alter table public.projects add column approved_by uuid references auth.users(id);
alter table public.projects add column approved_estimate jsonb;
grant insert(client_id) on public.projects to authenticated;
create policy master_project_insert on public.projects as restrictive for insert to authenticated with check(public.is_master() and status='DRAFT');
create policy master_categories on public.service_categories as restrictive for all to authenticated using(public.is_master()) with check(public.is_master());
create policy master_services on public.services as restrictive for all to authenticated using(public.is_master()) with check(public.is_master());

create table public.project_members (
 project_id uuid not null references public.projects(id) on delete cascade,
 user_id uuid not null references auth.users(id), joined_at timestamptz not null default now(), primary key(project_id,user_id)
);
create table public.project_invites (
 token uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
 expires_at timestamptz not null default now()+interval '7 days', created_at timestamptz not null default now(),
 accepted_at timestamptz, accepted_by uuid references auth.users(id), revoked_at timestamptz
);
alter table public.project_members enable row level security;
alter table public.project_invites enable row level security;
create function public.can_read_project(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.projects where id=p_id and user_id=auth.uid()) or exists(select 1 from public.project_members where project_id=p_id and user_id=auth.uid())
$$;
create policy invited_projects on public.projects for select to authenticated using(public.can_read_project(id));
create function public.make_invite(p_project_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare t uuid; begin
 perform 1 from public.projects where id=p_project_id and user_id=auth.uid() for update;
 if not found then raise exception 'Проєкт недоступний.'; end if;
 if exists(select 1 from public.project_members where project_id=p_project_id) then raise exception 'Замовника вже підключено.'; end if;
 update public.project_invites set revoked_at=now() where project_id=p_project_id and accepted_at is null and revoked_at is null;
 insert into public.project_invites(project_id) values(p_project_id) returning token into t; return t;
end $$;
create function public.accept_invite(p_token uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare inv public.project_invites%rowtype; begin
 if auth.uid() is null then raise exception 'Спочатку увійдіть.'; end if;
 select * into inv from public.project_invites where token=p_token;
 if not found then raise exception 'Запрошення недоступне.'; end if;
 perform 1 from public.projects where id=inv.project_id for update;
 select * into inv from public.project_invites where token=p_token for update;
 if inv.accepted_by=auth.uid() then return inv.project_id; end if;
 if inv.revoked_at is not null or inv.expires_at<now() or inv.accepted_at is not null then raise exception 'Запрошення втратило чинність.'; end if;
 if exists(select 1 from public.accounts where user_id=auth.uid() and role='MASTER') then raise exception 'Це запрошення для акаунта замовника. Увійдіть як замовник.'; end if;
 if exists(select 1 from public.project_members where project_id=inv.project_id) then raise exception 'Замовника вже підключено.'; end if;
 insert into public.accounts(user_id,role) values(auth.uid(),'CLIENT') on conflict do nothing;
 insert into public.project_members(project_id,user_id) values(inv.project_id,auth.uid());
 update public.project_invites set accepted_at=now(),accepted_by=auth.uid() where token=p_token;
 return inv.project_id;
end $$;

create table public.work_reports (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id),
 item_id uuid not null, quantity numeric(12,3) not null check(quantity>0),
 status text not null default 'SUBMITTED' check(status in ('SUBMITTED','CONFIRMED','CHANGES_REQUESTED')),
 unit_price numeric(12,2) not null, adjustment_percent numeric(6,2) not null,
 amount numeric(12,2) generated always as(round(quantity*unit_price*(1+adjustment_percent/100),2)) stored,
 note text not null default '' check(length(note)<=2000), photos text[] not null default '{}' check(cardinality(photos)<=10),
 occurred_at timestamptz not null, submitted_at timestamptz not null default now(), submitted_by uuid not null references auth.users(id),
 reviewed_at timestamptz, reviewed_by uuid references auth.users(id), review_note text check(length(review_note)<=2000),
 foreign key(item_id,project_id) references public.project_items(id,project_id)
);
alter table public.work_reports enable row level security;
grant select on public.work_reports to authenticated;
create policy project_reports_read on public.work_reports for select to authenticated using(public.can_read_project(project_id));
create index reports_project on public.work_reports(project_id,submitted_at);

create function public.workflow_detail(p_project_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; begin
 if not public.can_read_project(p_project_id) then raise exception 'Проєкт недоступний.' using errcode='42501'; end if;
 select jsonb_build_object(
 'project',to_jsonb(p), 'is_owner',p.user_id=auth.uid(),
 'has_client',exists(select 1 from public.project_members where project_id=p.id),
 'items',coalesce((select jsonb_agg(to_jsonb(i) order by position) from public.project_items i where project_id=p.id),'[]'::jsonb),
 'reports',coalesce((select jsonb_agg(to_jsonb(r) order by submitted_at desc) from public.work_reports r where project_id=p.id),'[]'::jsonb),
 'payments',coalesce((select jsonb_agg(to_jsonb(r) order by recorded_at desc) from public.project_payments r where project_id=p.id),'[]'::jsonb),
 'confirmed_total',coalesce((select sum(amount) from public.work_reports where project_id=p.id and status='CONFIRMED'),0),
 'pending_count',(select count(*) from public.work_reports where project_id=p.id and status='SUBMITTED'),
 'activity',coalesce((select jsonb_agg(jsonb_build_object('action',action,'occurred_at',occurred_at,'note',details->>'note') order by recorded_at desc) from public.project_events where project_id=p.id and action='request_changes'),'[]'::jsonb)
 ) into result from public.projects p where p.id=p_project_id;
 return result;
end $$;

create function public.workflow_action(p_project_id uuid,p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.projects%rowtype; i public.project_items%rowtype; r public.work_reports%rowtype; owner boolean; client boolean; qty numeric; photo text; rid uuid; occurred timestamptz; begin
 select * into p from public.projects where id=p_project_id for update;
 if not found then raise exception 'Проєкт недоступний.'; end if;
 owner:=p.user_id=auth.uid(); client:=exists(select 1 from public.project_members where project_id=p.id and user_id=auth.uid());
 if not coalesce(owner,false) and not client then raise exception 'Проєкт недоступний.' using errcode='42501'; end if;
 if (p_payload->>'version')::integer is distinct from p.version then raise exception 'Дані змінилися. Оновіть сторінку.' using errcode='40001'; end if;
 if length(coalesce(p_payload->>'note',''))>2000 then raise exception 'Коментар має містити до 2000 символів.'; end if;
 if p_action='link_client' and owner then
   if p.status<>'DRAFT' then raise exception 'Клієнта можна обрати у чернетці.'; end if;
   update public.projects set client_id=(p_payload->>'client_id')::uuid,client=coalesce((select name from public.clients where id=(p_payload->>'client_id')::uuid and user_id=auth.uid()),'') where id=p.id;
 elsif p_action='request_approval' and owner then
   if p.status<>'DRAFT' or not exists(select 1 from public.project_members where project_id=p.id) or not exists(select 1 from public.project_items where project_id=p.id) then raise exception 'Потрібні чернетка, пункти кошторису та підключений замовник.'; end if;
   update public.projects set status='PENDING_APPROVAL' where id=p.id;
 elsif p_action='approve' and client then
   if p.status<>'PENDING_APPROVAL' then raise exception 'Кошторис не очікує погодження.'; end if;
   update public.projects set status='IN_PROGRESS',approved_at=now(),approved_by=auth.uid(),approved_estimate=(select jsonb_agg(to_jsonb(x) order by position) from public.project_items x where project_id=p.id) where id=p.id;
 elsif p_action='request_changes' and client then
   if p.status<>'PENDING_APPROVAL' or length(btrim(coalesce(p_payload->>'note','')))=0 then raise exception 'Вкажіть причину повернення кошторису.'; end if;
   update public.projects set status='DRAFT' where id=p.id;
 elsif p_action='revise' and owner then
   if p.status not in ('IN_PROGRESS','COMPLETED','PENDING_APPROVAL') or exists(select 1 from public.work_reports where project_id=p.id and status='SUBMITTED') then raise exception 'Спочатку дочекайтеся перевірки звітів.'; end if;
   update public.projects set status='DRAFT',approved_at=null,approved_by=null where id=p.id;
 elsif p_action='finish' and owner then
   if p.status<>'IN_PROGRESS' or exists(select 1 from public.work_reports where project_id=p.id and status='SUBMITTED') or exists(select 1 from public.project_items x where project_id=p.id and coalesce((select sum(quantity) from public.work_reports where item_id=x.id and status='CONFIRMED'),0)<x.quantity) then raise exception 'Потрібне підтвердження всіх планових обсягів.'; end if;
   update public.projects set status='COMPLETED' where id=p.id;
 elsif p_action='submit_report' and owner then
   if p.status<>'IN_PROGRESS' then raise exception 'Звіти доступні лише для проєкту в роботі.'; end if;
   select * into i from public.project_items where id=(p_payload->>'item_id')::uuid and project_id=p.id;
   if not found then raise exception 'Роботу не знайдено.'; end if;
   qty:=(p_payload->>'quantity')::numeric; rid:=(p_payload->>'id')::uuid; occurred:=(p_payload->>'occurred_at')::timestamptz;
   if qty is null or qty<=0 or qty<>round(qty,3) or qty+coalesce((select sum(quantity) from public.work_reports where item_id=i.id and status in ('SUBMITTED','CONFIRMED')),0)>i.quantity then raise exception 'Обсяг перевищує залишок плану або некоректний.'; end if;
   if occurred is null or not isfinite(occurred) or occurred>now()+interval '5 minutes' then raise exception 'Вкажіть коректну дату виконання.'; end if;
   for photo in select jsonb_array_elements_text(coalesce(p_payload->'photos','[]')) loop
     if photo not like p.id::text||'/'||auth.uid()::text||'/'||rid::text||'/%' or photo like '%..%' then raise exception 'Недопустимий шлях фото.'; end if;
   end loop;
   insert into public.work_reports(id,project_id,item_id,quantity,unit_price,adjustment_percent,note,photos,occurred_at,submitted_by)
   values(rid,p.id,i.id,qty,i.unit_price,i.adjustment_percent,coalesce(p_payload->>'note',''),array(select jsonb_array_elements_text(coalesce(p_payload->'photos','[]'))),occurred,auth.uid());
 elsif p_action in ('confirm_report','return_report') and client then
   select * into r from public.work_reports where id=(p_payload->>'id')::uuid and project_id=p.id for update;
   if not found or r.status<>'SUBMITTED' or p.status<>'IN_PROGRESS' then raise exception 'Звіт уже оброблений або недоступний.'; end if;
   if p_action='return_report' and length(btrim(coalesce(p_payload->>'note','')))=0 then raise exception 'Вкажіть, що потрібно виправити.'; end if;
   update public.work_reports set status=case p_action when 'confirm_report' then 'CONFIRMED' else 'CHANGES_REQUESTED' end,reviewed_at=now(),reviewed_by=auth.uid(),review_note=coalesce(p_payload->>'note','') where id=r.id;
 else raise exception 'Дія недоступна для вашої ролі.' using errcode='42501'; end if;
 insert into public.project_events(project_id,action,occurred_at,details) values(p.id,p_action,now(),p_payload||jsonb_build_object('actor',auth.uid()));
 update public.projects set version=version+1,updated_at=now() where id=p.id;
 return public.workflow_detail(p.id);
end $$;

-- Retain the tested money ledger; gate legacy actions behind the new workflow.
alter function public.project_mutate(uuid,text,jsonb,uuid) rename to project_mutate_legacy;
revoke all on function public.project_mutate_legacy(uuid,text,jsonb,uuid) from public,anon,authenticated;
create function public.project_mutate(p_project_id uuid,p_action text,p_payload jsonb,p_request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.projects%rowtype; result jsonb; begin
 select * into p from public.projects where id=p_project_id and user_id=auth.uid() for update;
 if not found or not public.is_master() then raise exception 'Проєкт недоступний.' using errcode='42501'; end if;
 if p_action in ('status','complete_item') then raise exception 'Використовуйте погодження та звіти.'; end if;
 if p_action in ('add_item','edit_item','delete_item') then
   if p.status<>'DRAFT' then raise exception 'Спочатку відкрийте нову редакцію кошторису.'; end if;
   if p_action<>'add_item' and exists(select 1 from public.work_reports where item_id=(p_payload->>'item_id')::uuid) then raise exception 'Пункт із історією звітів не можна змінити. Додайте нову роботу.'; end if;
 end if;
 result:=public.project_mutate_legacy(p_project_id,p_action,p_payload,p_request_id); return result;
end $$;

create function public.workspace_projects() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object(
 'confirmed_total',coalesce((select sum(amount) from public.work_reports where project_id=p.id and status='CONFIRMED'),0),
 'advance_total',coalesce((select sum(amount) from public.project_payments where project_id=p.id and kind='advance' and voided_at is null),0),
 'pending_count',(select count(*) from public.work_reports where project_id=p.id and status='SUBMITTED'),
 'progress',coalesce((select round(avg(least(1,coalesce((select sum(quantity) from public.work_reports r where r.item_id=i.id and r.status='CONFIRMED'),0)/i.quantity))*100) from public.project_items i where i.project_id=p.id),0)
 ) order by p.created_at desc),'[]'::jsonb) from public.projects p where public.can_read_project(p.id)
$$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('reports','reports',false,5242880,array['image/jpeg','image/webp','image/png']) on conflict(id) do nothing;
create policy report_photo_read on storage.objects for select to authenticated using(bucket_id='reports' and exists(select 1 from public.work_reports r where name=any(r.photos) and public.can_read_project(r.project_id)));
create policy report_photo_upload on storage.objects for insert to authenticated with check(bucket_id='reports' and (storage.foldername(name))[2]=auth.uid()::text and exists(select 1 from public.projects where id::text=(storage.foldername(name))[1] and user_id=auth.uid() and status='IN_PROGRESS'));
create policy report_photo_delete on storage.objects for delete to authenticated using(bucket_id='reports' and (storage.foldername(name))[2]=auth.uid()::text and not exists(select 1 from public.work_reports where name=any(photos)));
create policy report_upload_owner_read on storage.objects for select to authenticated using(bucket_id='reports' and (storage.foldername(name))[2]=auth.uid()::text);

revoke all on function public.choose_role(text), public.is_master(), public.can_read_project(uuid), public.make_invite(uuid), public.accept_invite(uuid), public.workflow_detail(uuid), public.workflow_action(uuid,text,jsonb), public.project_mutate(uuid,text,jsonb,uuid), public.workspace_projects() from public,anon;
grant execute on function public.choose_role(text), public.is_master(), public.can_read_project(uuid), public.make_invite(uuid), public.accept_invite(uuid), public.workflow_detail(uuid), public.workflow_action(uuid,text,jsonb), public.project_mutate(uuid,text,jsonb,uuid), public.workspace_projects() to authenticated;
commit;
