begin;

alter table public.accounts add column username text unique;
alter table public.accounts add constraint accounts_username_check check(username is null or (username ~ '^[a-z][a-z0-9-]{2,29}$' and username not like '%--%' and right(username,1)<>'-' and username not in ('login','auth','projects','services','clients','portfolio','settings','welcome','share','invite','api','admin','support','icons','fonts','offline','www','master-check')));
create function public.username_available(p_username text) returns boolean language sql stable security definer set search_path='' as $$
 select p_username ~ '^[a-z][a-z0-9-]{2,29}$' and p_username not like '%--%' and right(p_username,1)<>'-' and p_username not in ('login','auth','projects','services','clients','portfolio','settings','welcome','share','invite','api','admin','support','icons','fonts','offline','www','master-check') and not exists(select 1 from public.accounts where username=p_username)
$$;
create function public.register_master(p_username text) returns text language plpgsql security definer set search_path='' as $$
declare current_account public.accounts%rowtype; begin
 if auth.uid() is null then raise exception 'Спочатку увійдіть.'; end if;
 select * into current_account from public.accounts where user_id=auth.uid() for update;
 if current_account.role='CLIENT' then raise exception 'Роль замовника вже обрана.'; end if;
 if current_account.username is not null then return current_account.username; end if;
 if p_username is null or not public.username_available(p_username) then raise exception 'Цей username недоступний. Оберіть інший.'; end if;
 insert into public.accounts(user_id,role,username) values(auth.uid(),'MASTER',p_username)
 on conflict(user_id) do update set username=excluded.username where public.accounts.role='MASTER' and public.accounts.username is null;
 return (select username from public.accounts where user_id=auth.uid());
 exception when unique_violation then raise exception 'Цей username уже зайнятий. Оберіть інший.';
end $$;
create or replace function public.is_master() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.accounts where user_id=auth.uid() and role='MASTER' and username is not null)$$;

-- Correct the correlated object path for databases that already ran collaboration v1.
drop policy report_photo_upload on storage.objects;
create policy report_photo_upload on storage.objects for insert to authenticated with check(bucket_id='reports' and (storage.foldername(name))[2]=auth.uid()::text and exists(select 1 from public.projects where id::text=(storage.foldername(storage.objects.name))[1] and user_id=auth.uid() and status='IN_PROGRESS'));

create function public.project_slug(p_name text) returns text language plpgsql immutable set search_path='' as $$
declare source text:=lower(btrim(p_name)); result text:=''; ch text; mapped text; idx integer; initial boolean; begin
 for idx in 1..length(source) loop
  ch:=substr(source,idx,1); initial:=idx=1 or substr(source,idx-1,1) !~ '[a-zа-яіїєґ0-9]';
  mapped:=case ch when 'а' then 'a' when 'б' then 'b' when 'в' then 'v' when 'г' then 'h' when 'ґ' then 'g' when 'д' then 'd' when 'е' then 'e' when 'є' then case when initial then 'ye' else 'ie' end when 'ж' then 'zh' when 'з' then 'z' when 'и' then 'y' when 'і' then 'i' when 'ї' then case when initial then 'yi' else 'i' end when 'й' then case when initial then 'y' else 'i' end when 'к' then 'k' when 'л' then 'l' when 'м' then 'm' when 'н' then 'n' when 'о' then 'o' when 'п' then 'p' when 'р' then 'r' when 'с' then 's' when 'т' then 't' when 'у' then 'u' when 'ф' then 'f' when 'х' then 'kh' when 'ц' then 'ts' when 'ч' then 'ch' when 'ш' then 'sh' when 'щ' then 'shch' when 'ь' then '' when 'ю' then case when initial then 'yu' else 'iu' end when 'я' then case when initial then 'ya' else 'ia' end when '''' then '' when '’' then '' else ch end;
  result:=result||mapped;
 end loop;
 return trim(both '-' from left(regexp_replace(result,'[^a-z0-9]+','-','g'),100));
end $$;
alter table public.projects add column slug text;
-- Preserve existing projects, disambiguating only historical duplicates.
do $$declare p record; base text; candidate text; suffix integer; begin
 for p in select id,user_id,name from public.projects order by created_at,id loop
  base:=coalesce(nullif(public.project_slug(p.name),''),'proekt'); candidate:=base; suffix:=1;
  while exists(select 1 from public.projects where user_id=p.user_id and slug=candidate) loop suffix:=suffix+1; candidate:=left(base,90)||'-'||suffix::text; end loop;
  update public.projects set slug=candidate where id=p.id;
 end loop;
end $$;
alter table public.projects alter column slug set not null;
alter table public.projects add constraint projects_owner_slug_unique unique(user_id,slug);
create function public.assign_project_slug() returns trigger language plpgsql set search_path='' as $$begin
 new.slug:=public.project_slug(new.name);
 if new.slug='' then raise exception 'У назві потрібні українські або латинські літери чи цифри.'; end if;
 return new;
end $$;
create trigger assign_project_slug before insert on public.projects for each row execute function public.assign_project_slug();

create function public.resolve_project(p_username text,p_slug text) returns uuid language sql stable security definer set search_path='' as $$
 select p.id from public.projects p join public.accounts a on a.user_id=p.user_id where a.username=p_username and p.slug=p_slug and public.can_read_project(p.id)
$$;
alter function public.workflow_detail(uuid) rename to workflow_detail_v1;
revoke all on function public.workflow_detail_v1(uuid) from public,anon,authenticated;
create function public.workflow_detail(p_project_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare d jsonb; begin
 d:=public.workflow_detail_v1(p_project_id);
 return jsonb_set(d,'{project}',(d->'project')||jsonb_build_object('owner_username',(select a.username from public.accounts a join public.projects p on p.user_id=a.user_id where p.id=p_project_id)));
end $$;
alter function public.workspace_projects() rename to workspace_projects_v1;
revoke all on function public.workspace_projects_v1() from public,anon,authenticated;
create function public.workspace_projects() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(p||jsonb_build_object('owner_username',(select username from public.accounts where user_id=(p->>'user_id')::uuid))),'[]'::jsonb) from jsonb_array_elements(public.workspace_projects_v1()) p
$$;

-- A hidden album keeps its URL and becomes available there when republished.
alter function public.portfolio_action(text,jsonb) rename to portfolio_action_v1;
revoke all on function public.portfolio_action_v1(text,jsonb) from public,anon,authenticated;
create function public.portfolio_action(p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$declare aid uuid; token uuid; begin
 if not public.is_master() then raise exception 'Доступно лише майстру.' using errcode='42501'; end if;
 if p_action='share_all' then
  update public.accounts set portfolio_public=(p_payload->>'published')::boolean where user_id=auth.uid() returning portfolio_token into token;
  return jsonb_build_object('token',token);
 elsif p_action in ('publish','remove_all_photos') then
  select id into aid from public.portfolio_albums where id=(p_payload->>'id')::uuid and user_id=auth.uid() for update;
  if not found then raise exception 'Альбом недоступний.'; end if;
  if p_action='publish' then update public.portfolio_albums set published=(p_payload->>'published')::boolean where id=aid;
  else delete from public.portfolio_photos where album_id=aid; end if;
  return jsonb_build_object('id',aid);
 end if;
 return public.portfolio_action_v1(p_action,p_payload);
end $$;

alter table public.projects add column overview_video_path text;
alter table public.projects add column overview_video_at timestamptz;
alter table public.portfolio_albums add column overview_video_path text;
alter table public.portfolio_albums add column overview_video_at timestamptz;
create function public.set_overview_video(p_project_id uuid default null,p_album_id uuid default null,p_path text default null) returns text language plpgsql security definer set search_path='' as $$
declare previous text; prefix text; begin
 if not public.is_master() or (p_project_id is null)=(p_album_id is null) then raise exception 'Дія недоступна.'; end if;
 if p_project_id is not null then
  select overview_video_path into previous from public.projects where id=p_project_id and user_id=auth.uid() for update;
  prefix:=auth.uid()::text||'/project/'||p_project_id::text||'/';
 else
  select overview_video_path into previous from public.portfolio_albums where id=p_album_id and user_id=auth.uid() for update;
  prefix:=auth.uid()::text||'/album/'||p_album_id::text||'/';
 end if;
 if not found then raise exception 'Об’єкт недоступний.'; end if;
 if p_path is not null and (p_path not like prefix||'%' or p_path like '%..%') then raise exception 'Недопустимий шлях відео.'; end if;
 if p_project_id is not null then
  update public.projects set overview_video_path=p_path,overview_video_at=case when p_path is null then null else now() end,updated_at=now(),version=version+1 where id=p_project_id;
  insert into public.project_events(project_id,action,occurred_at,details) values(p_project_id,'overview_video',now(),jsonb_build_object('actor',auth.uid(),'removed',p_path is null));
 else update public.portfolio_albums set overview_video_path=p_path,overview_video_at=case when p_path is null then null else now() end where id=p_album_id;
 end if;
 return previous;
end $$;
create function public.can_read_overview_video(p_path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.projects where overview_video_path=p_path and public.can_read_project(id)) or exists(select 1 from public.portfolio_albums where overview_video_path=p_path and (user_id=auth.uid() or published))
$$;
-- Avoid granting anon access to the private project access helper.
revoke all on function public.can_read_overview_video(text) from public;
grant execute on function public.can_read_overview_video(text) to anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('overview-video','overview-video',false,52428800,array['video/mp4','video/webm']) on conflict(id) do nothing;
create policy overview_video_read on storage.objects for select to anon,authenticated using(bucket_id='overview-video' and public.can_read_overview_video(name));
create policy overview_video_owner_read on storage.objects for select to authenticated using(bucket_id='overview-video' and (storage.foldername(name))[1]=auth.uid()::text);
create policy overview_video_upload on storage.objects for insert to authenticated with check(bucket_id='overview-video' and public.is_master() and (storage.foldername(name))[1]=auth.uid()::text and (
 ((storage.foldername(name))[2]='project' and exists(select 1 from public.projects p where p.id::text=(storage.foldername(storage.objects.name))[3] and p.user_id=auth.uid())) or
 ((storage.foldername(name))[2]='album' and exists(select 1 from public.portfolio_albums a where a.id::text=(storage.foldername(storage.objects.name))[3] and a.user_id=auth.uid()))));
create policy overview_video_delete on storage.objects for delete to authenticated using(bucket_id='overview-video' and (storage.foldername(name))[1]=auth.uid()::text and not exists(select 1 from public.projects where overview_video_path=storage.objects.name) and not exists(select 1 from public.portfolio_albums where overview_video_path=storage.objects.name));
create or replace function public.public_portfolio(p_token uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'description',a.description,'overview_video_path',a.overview_video_path,'overview_video_at',a.overview_video_at,
 'categories',coalesce((select jsonb_agg(name) from public.service_categories where id=any(a.category_ids)),'[]'::jsonb),
 'photos',coalesce((select jsonb_agg(jsonb_build_object('id',id,'path',path,'caption',caption) order by created_at) from public.portfolio_photos where album_id=a.id),'[]'::jsonb)) order by a.created_at desc),'[]'::jsonb)
 from public.portfolio_albums a where a.published and (a.share_token=p_token or exists(select 1 from public.accounts where user_id=a.user_id and portfolio_public and portfolio_token=p_token))
$$;

create index project_members_user on public.project_members(user_id);
create index project_invites_project on public.project_invites(project_id);
revoke all on function public.username_available(text),public.register_master(text),public.project_slug(text),public.assign_project_slug(),public.resolve_project(text,text),public.workflow_detail(uuid),public.workspace_projects(),public.portfolio_action(text,jsonb),public.set_overview_video(uuid,uuid,text) from public,anon;
grant execute on function public.username_available(text),public.register_master(text),public.project_slug(text),public.resolve_project(text,text),public.workflow_detail(uuid),public.workspace_projects(),public.portfolio_action(text,jsonb),public.set_overview_video(uuid,uuid,text) to authenticated;
commit;
