begin;

-- Invites no longer reveal whether an email belongs to a registered client.
create or replace function public.make_invite(p_project_id uuid,p_email text) returns uuid language plpgsql security definer set search_path='' as $$
declare t uuid; begin
 if not exists(select 1 from public.projects where id=p_project_id and user_id=auth.uid()) then raise exception 'Проєкт недоступний.' using errcode='42501'; end if;
 if p_email is null or length(btrim(p_email))>254 or btrim(p_email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Вкажіть повну електронну адресу.'; end if;
 t:=public.make_invite_unbound(p_project_id);
 update public.project_invites set recipient_email=lower(btrim(p_email)) where token=t;
 return t;
end $$;
drop function public.find_project_client(uuid,text);

-- Deleting an account removes its own data and keeps the other side's records.
alter table public.clients drop constraint clients_user_id_fkey;
alter table public.clients add constraint clients_user_id_fkey foreign key(user_id) references auth.users(id) on delete cascade;
alter table public.projects drop constraint projects_approved_by_fkey;
alter table public.projects add constraint projects_approved_by_fkey foreign key(approved_by) references auth.users(id) on delete set null;
alter table public.project_members drop constraint project_members_user_id_fkey;
alter table public.project_members add constraint project_members_user_id_fkey foreign key(user_id) references auth.users(id) on delete cascade;
alter table public.project_invites drop constraint project_invites_accepted_by_fkey;
alter table public.project_invites add constraint project_invites_accepted_by_fkey foreign key(accepted_by) references auth.users(id) on delete set null;
alter table public.work_reports drop constraint work_reports_project_id_fkey;
alter table public.work_reports add constraint work_reports_project_id_fkey foreign key(project_id) references public.projects(id) on delete cascade;
alter table public.work_reports drop constraint work_reports_submitted_by_fkey;
alter table public.work_reports add constraint work_reports_submitted_by_fkey foreign key(submitted_by) references auth.users(id) on delete cascade;
alter table public.work_reports drop constraint work_reports_reviewed_by_fkey;
alter table public.work_reports add constraint work_reports_reviewed_by_fkey foreign key(reviewed_by) references auth.users(id) on delete set null;
alter table public.portfolio_albums drop constraint portfolio_albums_user_id_fkey;
alter table public.portfolio_albums add constraint portfolio_albums_user_id_fkey foreign key(user_id) references auth.users(id) on delete cascade;
alter table public.project_comments drop constraint project_comments_project_id_fkey;
alter table public.project_comments add constraint project_comments_project_id_fkey foreign key(project_id) references public.projects(id) on delete cascade;
alter table public.project_comments alter column author_id drop not null;
alter table public.project_comments drop constraint project_comments_author_id_fkey;
alter table public.project_comments add constraint project_comments_author_id_fkey foreign key(author_id) references auth.users(id) on delete set null;
alter table public.payment_notices drop constraint payment_notices_project_id_fkey;
alter table public.payment_notices add constraint payment_notices_project_id_fkey foreign key(project_id) references public.projects(id) on delete cascade;
alter table public.payment_notices alter column author_id drop not null;
alter table public.payment_notices drop constraint payment_notices_author_id_fkey;
alter table public.payment_notices add constraint payment_notices_author_id_fkey foreign key(author_id) references auth.users(id) on delete set null;

-- Lookups used by reports, allocations, portfolio pages and contacts.
create index work_reports_item on public.work_reports(item_id);
create index project_allocations_item on public.project_allocations(item_id);
create index project_allocations_payment on public.project_allocations(payment_id);
create index portfolio_albums_user on public.portfolio_albums(user_id,created_at desc);
create index portfolio_photos_album on public.portfolio_photos(album_id,created_at);
create index clients_user on public.clients(user_id,name);
create index projects_client on public.projects(client_id) where client_id is not null;

-- Invited projects come from one membership lookup instead of a function call per project.
create function public.member_project_ids() returns setof uuid language sql stable security definer set search_path='' as $$
 select project_id from public.project_members where user_id=auth.uid()
$$;
drop policy invited_projects on public.projects;
create policy invited_projects on public.projects for select to authenticated using(id in (select public.member_project_ids()));
create or replace function public.workspace_projects_v1() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object(
 'confirmed_total',coalesce((select sum(amount) from public.work_reports where project_id=p.id and status='CONFIRMED'),0),
 'advance_total',coalesce((select sum(amount) from public.project_payments where project_id=p.id and kind='advance' and voided_at is null),0),
 'pending_count',(select count(*) from public.work_reports where project_id=p.id and status='SUBMITTED'),
 'progress',coalesce((select round(avg(least(1,coalesce((select sum(quantity) from public.work_reports r where r.item_id=i.id and r.status='CONFIRMED'),0)/i.quantity))*100) from public.project_items i where i.project_id=p.id),0)
 ) order by p.created_at desc),'[]'::jsonb) from public.projects p
 where p.user_id=(select auth.uid()) or p.id in (select project_id from public.project_members where user_id=(select auth.uid()))
$$;

-- Evaluate auth helpers once per query, not once per row.
drop policy accounts_self on public.accounts;
create policy accounts_self on public.accounts for select to authenticated using(user_id=(select auth.uid()));
drop policy own_clients on public.clients;
create policy own_clients on public.clients for all to authenticated using(user_id=(select auth.uid()) and (select public.is_master())) with check(user_id=(select auth.uid()) and (select public.is_master()));
drop policy master_project_insert on public.projects;
create policy master_project_insert on public.projects as restrictive for insert to authenticated with check((select public.is_master()) and status='DRAFT');
drop policy master_categories on public.service_categories;
create policy master_categories on public.service_categories as restrictive for all to authenticated using((select public.is_master())) with check((select public.is_master()));
drop policy master_services on public.services;
create policy master_services on public.services as restrictive for all to authenticated using((select public.is_master())) with check((select public.is_master()));
drop policy own_albums on public.portfolio_albums;
create policy own_albums on public.portfolio_albums for select to authenticated using(user_id=(select auth.uid()));
drop policy own_portfolio_photos on public.portfolio_photos;
create policy own_portfolio_photos on public.portfolio_photos for select to authenticated using(exists(select 1 from public.portfolio_albums a where a.id=album_id and a.user_id=(select auth.uid())));

-- Storage checks start from the project id in the path, so they use project indexes.
create function public.path_uuid(p_path text,p_part integer) returns uuid language sql immutable set search_path='' as $$
 select case when split_part(p_path,'/',p_part) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then split_part(p_path,'/',p_part)::uuid end
$$;
create function public.can_read_report_photo(p_path text) returns boolean language sql stable security definer set search_path='' as $$
 select public.can_read_project(public.path_uuid(p_path,1)) and exists(select 1 from public.work_reports where project_id=public.path_uuid(p_path,1) and p_path=any(photos))
$$;
drop policy report_photo_read on storage.objects;
create policy report_photo_read on storage.objects for select to authenticated using(bucket_id='reports' and public.can_read_report_photo(name));
drop policy report_photo_delete on storage.objects;
create policy report_photo_delete on storage.objects for delete to authenticated using(bucket_id='reports' and (storage.foldername(name))[2]=auth.uid()::text and not exists(select 1 from public.work_reports r where r.project_id=public.path_uuid(storage.objects.name,1) and storage.objects.name=any(r.photos)));
create function public.attachment_in_use(p_path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.project_comments where project_id=public.path_uuid(p_path,1) and attachments @> jsonb_build_array(jsonb_build_object('path',p_path)))
 or exists(select 1 from public.payment_notices where project_id=public.path_uuid(p_path,1) and attachments @> jsonb_build_array(jsonb_build_object('path',p_path)))
$$;
create or replace function public.project_attachment_read(p_path text) returns boolean language sql stable security definer set search_path='' as $$
 select public.can_read_project(public.path_uuid(p_path,1)) and public.attachment_in_use(p_path)
$$;
-- Members may keep up to 30 unsent files per project; saved attachments do not count.
create function public.can_upload_attachment(p_path text) returns boolean language sql stable security definer set search_path='' as $$
 select (storage.foldername(p_path))[2]=auth.uid()::text and public.can_read_project(public.path_uuid(p_path,1))
 and (select count(*) from storage.objects o where o.bucket_id='project-attachments' and o.name like public.path_uuid(p_path,1)::text||'/'||auth.uid()::text||'/%' and not public.attachment_in_use(o.name))<30
$$;
drop policy attachment_upload on storage.objects;
create policy attachment_upload on storage.objects for insert to authenticated with check(bucket_id='project-attachments' and public.can_upload_attachment(name));
-- Unsent uploads can be removed by their author; files of saved records stay immutable.
create policy attachment_owner_read on storage.objects for select to authenticated using(bucket_id='project-attachments' and (storage.foldername(name))[2]=auth.uid()::text);
create policy attachment_delete_unused on storage.objects for delete to authenticated using(bucket_id='project-attachments' and (storage.foldername(name))[2]=auth.uid()::text and not public.attachment_in_use(name));

-- A new revision is no longer approved, so its approval snapshot goes too.
create or replace function public.workflow_action(p_project_id uuid,p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; begin
 if not public.can_read_project(p_project_id) then raise exception 'Проєкт недоступний.' using errcode='42501'; end if;
 perform 1 from public.projects where id=p_project_id for update;
 if p_action='approve' and not exists(select 1 from public.project_items where project_id=p_project_id) then raise exception 'Неможливо погодити порожній кошторис. Дочекайтеся додавання робіт.'; end if;
 result:=public.workflow_action_before_pending_edits(p_project_id,p_action,p_payload);
 if p_action='revise' then
  update public.projects set approved_estimate=null where id=p_project_id;
  result:=public.workflow_detail(p_project_id);
 end if;
 return result;
end $$;

-- Project cards show the contact's current name.
create function public.sync_client_name() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.projects set client=new.name where client_id=new.id and user_id=new.user_id;
 return new;
end $$;
create trigger sync_client_name after update of name on public.clients for each row when(old.name is distinct from new.name) execute function public.sync_client_name();

-- A leaked public link can be replaced; the old address stops working.
create or replace function public.portfolio_action(p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$declare aid uuid; token uuid; begin
 if not public.is_master() then raise exception 'Доступно лише майстру.' using errcode='42501'; end if;
 if p_action='share_all' then
  update public.accounts set portfolio_public=(p_payload->>'published')::boolean where user_id=auth.uid() returning portfolio_token into token;
  return jsonb_build_object('token',token);
 elsif p_action='rotate_all' then
  update public.accounts set portfolio_token=gen_random_uuid() where user_id=auth.uid() returning portfolio_token into token;
  return jsonb_build_object('token',token);
 elsif p_action in ('publish','remove_all_photos','rotate_album') then
  select id into aid from public.portfolio_albums where id=(p_payload->>'id')::uuid and user_id=auth.uid() for update;
  if not found then raise exception 'Альбом недоступний.'; end if;
  if p_action='publish' then update public.portfolio_albums set published=(p_payload->>'published')::boolean where id=aid;
  elsif p_action='rotate_album' then update public.portfolio_albums set share_token=gen_random_uuid() where id=aid;
  else delete from public.portfolio_photos where album_id=aid; end if;
  return jsonb_build_object('id',aid);
 end if;
 return public.portfolio_action_v1(p_action,p_payload);
end $$;

-- Supabase grants new tables to every API role by default; keep only what the app uses.
revoke all on public.accounts,public.clients,public.project_members,public.project_invites,public.work_reports,public.portfolio_albums,public.portfolio_photos from anon,authenticated;
grant select on public.accounts,public.work_reports,public.portfolio_albums,public.portfolio_photos to authenticated;
grant select,insert,delete on public.clients to authenticated;
grant update(name,phone,notes,updated_at) on public.clients to authenticated;

revoke all on function public.member_project_ids(),public.path_uuid(text,integer),public.can_read_report_photo(text),public.attachment_in_use(text),public.can_upload_attachment(text),public.sync_client_name() from public,anon,authenticated;
-- Storage policies call these as the signed-in user.
grant execute on function public.member_project_ids(),public.path_uuid(text,integer),public.can_read_report_photo(text),public.attachment_in_use(text),public.can_upload_attachment(text) to authenticated;

commit;
