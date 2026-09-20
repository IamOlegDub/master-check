begin;

create table public.projects (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    name text not null check (char_length(btrim(name)) between 1 and 160),
    client text not null default '' check (char_length(client) <= 160),
    status text not null default 'Очікує старту'
        check (status in ('Очікує старту', 'В роботі', 'Завершено')),
    total numeric(12,2) not null default 0 check (total >= 0 and total <= 9999999999.99),
    paid numeric(12,2) not null default 0 check (paid >= 0 and paid <= total),
    created_at timestamptz not null default now()
);

create index projects_user_created_idx on public.projects(user_id, created_at desc);
alter table public.projects enable row level security;
revoke all on public.projects from anon, authenticated;
grant select, insert on public.projects to authenticated;

create policy "Read own projects" on public.projects
    for select to authenticated using ((select auth.uid()) = user_id);
create policy "Create own projects" on public.projects
    for insert to authenticated with check ((select auth.uid()) = user_id);

commit;
