begin;
create table public.portfolio_albums (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),
 title text not null check(length(btrim(title)) between 1 and 160), description text not null default '' check(length(description)<=2000),
 category_ids uuid[] not null default '{}',share_token uuid not null default gen_random_uuid() unique,
 published boolean not null default false,created_at timestamptz not null default now()
);
create table public.portfolio_photos (
 id uuid primary key default gen_random_uuid(),album_id uuid not null references public.portfolio_albums(id) on delete cascade,
 path text not null unique,caption text not null default '' check(length(caption)<=500),created_at timestamptz not null default now()
);
alter table public.portfolio_albums enable row level security;
alter table public.portfolio_photos enable row level security;
grant select on public.portfolio_albums,public.portfolio_photos to authenticated;
create policy own_albums on public.portfolio_albums for select to authenticated using(user_id=auth.uid());
create policy own_portfolio_photos on public.portfolio_photos for select to authenticated using(exists(select 1 from public.portfolio_albums where id=album_id and user_id=auth.uid()));
create function public.portfolio_action(p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare aid uuid; token uuid; cats uuid[]; begin
 if not public.is_master() then raise exception 'Доступно лише майстру.' using errcode='42501'; end if;
 if p_action='create' then
  cats:=array(select jsonb_array_elements_text(coalesce(p_payload->'category_ids','[]'))::uuid);
  if exists(select 1 from unnest(cats) x where not exists(select 1 from public.service_categories where id=x and user_id=auth.uid())) then raise exception 'Категорія недоступна.'; end if;
  insert into public.portfolio_albums(user_id,title,description,category_ids) values(auth.uid(),p_payload->>'title',coalesce(p_payload->>'description',''),cats) returning id into aid;
 elsif p_action='share_all' then
  update public.accounts set portfolio_public=(p_payload->>'published')::boolean,portfolio_token=case when (p_payload->>'published')::boolean then portfolio_token else gen_random_uuid() end where user_id=auth.uid() returning portfolio_token into token;
  return jsonb_build_object('token',token);
 else
  select id into aid from public.portfolio_albums where id=(p_payload->>'id')::uuid and user_id=auth.uid() for update;
  if not found then raise exception 'Альбом недоступний.'; end if;
  if p_action='publish' then
   update public.portfolio_albums set published=(p_payload->>'published')::boolean,share_token=case when (p_payload->>'published')::boolean then share_token else gen_random_uuid() end where id=aid;
  elsif p_action='photo' then
   if p_payload->>'path' not like auth.uid()::text||'/'||aid::text||'/%' or p_payload->>'path' like '%..%' then raise exception 'Недопустимий файл.'; end if;
   insert into public.portfolio_photos(album_id,path,caption) values(aid,p_payload->>'path',coalesce(p_payload->>'caption','')) on conflict(path) do nothing;
  elsif p_action='remove_photo' then
   delete from public.portfolio_photos where album_id=aid and id=(p_payload->>'photo_id')::uuid;
  elsif p_action='delete' then delete from public.portfolio_albums where id=aid;
  else raise exception 'Невідома дія.'; end if;
 end if;
 return jsonb_build_object('id',aid);
end $$;
create function public.public_portfolio(p_token uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'description',a.description,
 'categories',coalesce((select jsonb_agg(name) from public.service_categories where id=any(a.category_ids)),'[]'::jsonb),
 'photos',coalesce((select jsonb_agg(jsonb_build_object('id',id,'path',path,'caption',caption) order by created_at) from public.portfolio_photos where album_id=a.id),'[]'::jsonb)
 ) order by a.created_at desc),'[]'::jsonb) from public.portfolio_albums a
 where a.published and (a.share_token=p_token or exists(select 1 from public.accounts where user_id=a.user_id and portfolio_public and portfolio_token=p_token))
$$;
create function public.can_read_portfolio_path(p_path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.portfolio_photos ph join public.portfolio_albums a on a.id=ph.album_id where ph.path=p_path and (a.user_id=auth.uid() or a.published))
$$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('portfolio','portfolio',false,5242880,array['image/jpeg','image/webp','image/png']) on conflict(id) do nothing;
create policy portfolio_photo_read on storage.objects for select to anon,authenticated using(bucket_id='portfolio' and public.can_read_portfolio_path(name));
create policy portfolio_photo_upload on storage.objects for insert to authenticated with check(bucket_id='portfolio' and public.is_master() and (storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from public.portfolio_albums where id::text=(storage.foldername(name))[2] and user_id=auth.uid()));
create policy portfolio_photo_delete on storage.objects for delete to authenticated using(bucket_id='portfolio' and (storage.foldername(name))[1]=auth.uid()::text and not exists(select 1 from public.portfolio_photos where path=name));
create policy portfolio_upload_owner_read on storage.objects for select to authenticated using(bucket_id='portfolio' and (storage.foldername(name))[1]=auth.uid()::text);
revoke all on function public.portfolio_action(text,jsonb),public.public_portfolio(uuid),public.can_read_portfolio_path(text) from public;
grant execute on function public.portfolio_action(text,jsonb) to authenticated;
grant execute on function public.public_portfolio(uuid),public.can_read_portfolio_path(text) to anon,authenticated;
commit;
