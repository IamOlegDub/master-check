begin;

create table public.service_categories (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    name text not null check (name = btrim(name) and char_length(name) between 1 and 80),
    created_at timestamptz not null default now(),
    unique (id, user_id)
);
create unique index service_categories_owner_name_idx
    on public.service_categories (user_id, lower(name));

create table public.services (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    category_id uuid not null,
    name text not null check (name = btrim(name) and char_length(name) between 1 and 160),
    price numeric(12,2) not null check (price >= 0 and price <= 9999999999.99),
    unit text not null check (unit in ('m2', 'lm', 'm3', 'piece', 'hour', 'day', 'set', 'service', 'kg', 'tonne')),
    created_at timestamptz not null default now(),
    foreign key (category_id, user_id) references public.service_categories(id, user_id)
);
create index services_owner_category_idx on public.services(user_id, category_id);

alter table public.service_categories enable row level security;
alter table public.services enable row level security;
revoke all on public.service_categories, public.services from anon, authenticated;
grant select, insert, delete on public.service_categories, public.services to authenticated;
grant update (name) on public.service_categories to authenticated;
grant update (name, price, unit, category_id) on public.services to authenticated;

create policy "Read own categories" on public.service_categories for select to authenticated
    using ((select auth.uid()) = user_id);
create policy "Create own categories" on public.service_categories for insert to authenticated
    with check ((select auth.uid()) = user_id);
create policy "Edit own categories" on public.service_categories for update to authenticated
    using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own categories" on public.service_categories for delete to authenticated
    using ((select auth.uid()) = user_id);

create policy "Read own services" on public.services for select to authenticated
    using ((select auth.uid()) = user_id);
create policy "Create own services" on public.services for insert to authenticated
    with check ((select auth.uid()) = user_id);
create policy "Edit own services" on public.services for update to authenticated
    using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own services" on public.services for delete to authenticated
    using ((select auth.uid()) = user_id);

commit;
