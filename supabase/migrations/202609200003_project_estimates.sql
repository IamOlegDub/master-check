begin;

alter table public.projects add column updated_at timestamptz not null default now();
alter table public.projects add column version integer not null default 0;
-- PostgreSQL names a check that references both paid and total projects_check.
alter table public.projects drop constraint if exists projects_check;
alter table public.projects drop constraint if exists projects_paid_check;
alter table public.projects add constraint projects_paid_check check (paid >= 0 and paid <= 9999999999.99);
-- Totals are now maintained only by the transactional API.
revoke insert on public.projects from authenticated;
grant insert (id, user_id, name, client, status) on public.projects to authenticated;

create table public.project_items (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    service_id uuid,
    name text not null check (char_length(btrim(name)) between 1 and 160),
    category_name text not null default '',
    unit text not null check (unit in ('m2','lm','m3','piece','hour','day','set','service','kg','tonne')),
    quantity numeric(12,3) not null check (quantity > 0),
    unit_price numeric(12,2) not null check (unit_price >= 0 and unit_price <= 9999999999.99),
    adjustment_percent numeric(6,2) not null default 0 check (adjustment_percent between -100 and 1000),
    line_total numeric(12,2) generated always as (round(quantity * unit_price * (1 + adjustment_percent / 100), 2)) stored,
    note text not null default '' check (char_length(note) <= 500),
    position integer not null,
    completed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (id, project_id)
);
create index project_items_project_idx on public.project_items(project_id, position);
create table public.project_payments (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    kind text not null check (kind in ('advance','item')),
    amount numeric(12,2) not null check (amount > 0 and amount <= 9999999999.99),
    occurred_at timestamptz,
    recorded_at timestamptz not null default now(),
    note text not null default '' check (char_length(note) <= 500),
    voided_at timestamptz,
    void_reason text,
    unique (id, project_id)
);
create index project_payments_project_idx on public.project_payments(project_id);
create table public.project_allocations (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    payment_id uuid not null,
    item_id uuid not null,
    amount numeric(12,2) not null check (amount > 0),
    occurred_at timestamptz not null,
    recorded_at timestamptz not null default now(),
    released_at timestamptz,
    foreign key (payment_id, project_id) references public.project_payments(id, project_id),
    foreign key (item_id, project_id) references public.project_items(id, project_id)
);
create index project_allocations_project_idx on public.project_allocations(project_id);
create table public.project_events (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    action text not null,
    occurred_at timestamptz,
    recorded_at timestamptz not null default now(),
    details jsonb not null default '{}'
);
create index project_events_project_idx on public.project_events(project_id, recorded_at desc);
create table public.project_requests (
    project_id uuid not null references public.projects(id) on delete cascade,
    request_id uuid not null,
    action text not null,
    payload jsonb not null,
    primary key (project_id, request_id)
);

-- Preserve existing manually entered amounts without inventing historical dates.
insert into public.project_items(project_id, name, unit, quantity, unit_price, position, note)
select id, 'Початковий кошторис (до деталізації)', 'service', 1, total, 0,
       'Перенесена попередня сума. Замініть цей пункт деталізованими роботами, щоб не рахувати вартість двічі.'
from public.projects where total > 0;
insert into public.project_payments(project_id, kind, amount, note)
select id, 'advance', paid, 'Перенесена попередня оплата; точна дата отримання невідома.'
from public.projects where paid > 0;
insert into public.project_events(project_id, action, details)
select id, 'import', jsonb_build_object('total', total, 'paid', paid)
from public.projects where total > 0 or paid > 0;

alter table public.project_items enable row level security;
alter table public.project_payments enable row level security;
alter table public.project_allocations enable row level security;
alter table public.project_events enable row level security;
alter table public.project_requests enable row level security;
revoke all on public.project_items, public.project_payments, public.project_allocations, public.project_events, public.project_requests from anon, authenticated;
grant select on public.project_items, public.project_payments, public.project_allocations, public.project_events to authenticated;
create policy "Read own estimate" on public.project_items for select to authenticated using (exists(select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid())));
create policy "Read own receipts" on public.project_payments for select to authenticated using (exists(select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid())));
create policy "Read own allocations" on public.project_allocations for select to authenticated using (exists(select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid())));
create policy "Read own history" on public.project_events for select to authenticated using (exists(select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid())));

create function public.project_detail(p_project_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
    if not exists(select 1 from public.projects where id = p_project_id and user_id = auth.uid()) then
        raise exception 'Проєкт недоступний.' using errcode = '42501';
    end if;
    return jsonb_build_object(
        'project', (select to_jsonb(p) from public.projects p where p.id = p_project_id),
        'items', coalesce((select jsonb_agg(to_jsonb(i) || jsonb_build_object('paid_amount', coalesce((
            select sum(a.amount) from public.project_allocations a join public.project_payments r on r.id = a.payment_id
            where a.item_id = i.id and a.released_at is null and r.voided_at is null
        ), 0)) order by i.position, i.id) from public.project_items i where i.project_id = p_project_id), '[]'::jsonb),
        'payments', coalesce((select jsonb_agg(to_jsonb(r) order by r.recorded_at desc, r.id) from public.project_payments r where r.project_id = p_project_id), '[]'::jsonb),
        'allocations', coalesce((select jsonb_agg(to_jsonb(a)) from public.project_allocations a where a.project_id = p_project_id), '[]'::jsonb),
        'events', coalesce((select jsonb_agg(to_jsonb(e) order by e.recorded_at desc, e.id) from public.project_events e where e.project_id = p_project_id), '[]'::jsonb)
    );
end;
$$;

create function public.project_mutate(p_project_id uuid, p_action text, p_payload jsonb, p_request_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
    v_project public.projects%rowtype;
    v_item public.project_items%rowtype;
    v_service public.services%rowtype;
    v_payment public.project_payments%rowtype;
    v_request public.project_requests%rowtype;
    v_id uuid;
    v_date timestamptz;
    v_amount numeric;
    v_paid numeric;
    v_total numeric;
    v_quantity numeric;
    v_price numeric;
    v_adjustment numeric;
    v_note text := coalesce(p_payload->>'note', '');
    v_details jsonb := '{}';
    v_remaining numeric;
    v_part numeric;
    v_source record;
begin
    -- All writers serialize on the project row. Authorization and replay checks run inside this transaction.
    select * into v_project from public.projects where id = p_project_id and user_id = auth.uid() for update;
    if not found then raise exception 'Проєкт недоступний.' using errcode = '42501'; end if;
    if p_request_id is null or p_payload is null then raise exception 'Некоректний запит.'; end if;
    select * into v_request from public.project_requests where project_id = p_project_id and request_id = p_request_id;
    if found then
        if v_request.action <> p_action or v_request.payload <> p_payload then raise exception 'Ідентифікатор запиту вже використано.'; end if;
        return public.project_detail(p_project_id);
    end if;
    if (p_payload->>'version')::integer is distinct from v_project.version then
        raise exception 'Проєкт змінився в іншій вкладці. Оновіть дані та повторіть дію.' using errcode = '40001';
    end if;
    v_date := coalesce((p_payload->>'occurred_at')::timestamptz, now());
    if not isfinite(v_date) or v_date > now() + interval '5 minutes' then raise exception 'Вкажіть дату, що вже настала.'; end if;
    if char_length(v_note) > 500 then raise exception 'Примітка: максимум 500 символів.'; end if;

    if p_action in ('add_item', 'edit_item') then
        v_quantity := (p_payload->>'quantity')::numeric;
        v_adjustment := coalesce((p_payload->>'adjustment_percent')::numeric, 0);
        if v_quantity is null or v_quantity <= 0 or v_quantity > 999999999.999 or v_quantity <> round(v_quantity, 3)
            or v_adjustment not between -100 and 1000 or v_adjustment <> round(v_adjustment, 2) then
            raise exception 'Перевірте кількість та відсоток знижки/націнки.';
        end if;
        if p_action = 'add_item' then
            select * into v_service from public.services where id = (p_payload->>'service_id')::uuid and user_id = auth.uid();
            if not found then raise exception 'Послуга недоступна. Оновіть прайс.'; end if;
            v_price := v_service.price;
            insert into public.project_items(project_id, service_id, name, category_name, unit, quantity, unit_price, adjustment_percent, position, note)
            values (p_project_id, v_service.id, v_service.name, (select name from public.service_categories where id = v_service.category_id),
                v_service.unit, v_quantity, v_price, v_adjustment,
                (select coalesce(max(position), -1) + 1 from public.project_items where project_id = p_project_id), v_note)
            returning id into v_id;
        else
            select * into v_item from public.project_items where id = (p_payload->>'item_id')::uuid and project_id = p_project_id;
            if not found then raise exception 'Пункт недоступний.'; end if;
            v_price := (p_payload->>'unit_price')::numeric;
            if v_price is null or v_price < 0 or v_price > 9999999999.99 or v_price <> round(v_price, 2) then raise exception 'Некоректна ціна.'; end if;
            select coalesce(sum(a.amount), 0) into v_paid from public.project_allocations a join public.project_payments r on r.id = a.payment_id
                where a.item_id = v_item.id and a.released_at is null and r.voided_at is null;
            if round(v_quantity * v_price * (1 + v_adjustment / 100), 2) < v_paid then
                raise exception 'Сума пункту не може бути меншою за зараховану оплату. Спочатку виправте оплату або поверніть аванс.';
            end if;
            update public.project_items set quantity = v_quantity, unit_price = v_price, adjustment_percent = v_adjustment, note = v_note, updated_at = now() where id = v_item.id;
            v_id := v_item.id;
            v_details := jsonb_build_object('before', to_jsonb(v_item));
        end if;
        v_details := v_details || jsonb_build_object('after', (select to_jsonb(i) from public.project_items i where id = v_id));
    elsif p_action = 'delete_item' then
        select * into v_item from public.project_items where id = (p_payload->>'item_id')::uuid and project_id = p_project_id;
        if not found then raise exception 'Пункт недоступний.'; end if;
        if exists(select 1 from public.project_allocations a join public.project_payments r on r.id = a.payment_id where a.item_id = v_item.id and a.released_at is null and r.voided_at is null) then
            raise exception 'Спочатку скасуйте оплату або поверніть аванс цього пункту.';
        end if;
        -- Released/cancelled allocation details remain in the immutable event history.
        v_details := jsonb_build_object('before', to_jsonb(v_item), 'allocations', (select jsonb_agg(to_jsonb(a)) from public.project_allocations a where item_id = v_item.id));
        delete from public.project_allocations where item_id = v_item.id;
        delete from public.project_items where id = v_item.id;
    elsif p_action = 'complete_item' then
        select * into v_item from public.project_items where id = (p_payload->>'item_id')::uuid and project_id = p_project_id;
        if not found then raise exception 'Пункт недоступний.'; end if;
        if p_payload->>'completed' not in ('true','false') or p_payload->>'completed' is null then raise exception 'Вкажіть стан виконання.'; end if;
        update public.project_items set completed_at = case when (p_payload->>'completed')::boolean then v_date else null end, updated_at = now() where id = v_item.id;
        v_details := jsonb_build_object('name', v_item.name, 'completed', (p_payload->>'completed')::boolean, 'previous_completed_at', v_item.completed_at);
    elsif p_action in ('payment', 'allocate') then
        v_amount := (p_payload->>'amount')::numeric;
        if v_amount is null or v_amount <= 0 or v_amount > 9999999999.99 or v_amount <> round(v_amount, 2) then raise exception 'Вкажіть додатну суму з точністю до копійок.'; end if;
        if nullif(p_payload->>'item_id', '') is not null then
            select * into v_item from public.project_items where id = (p_payload->>'item_id')::uuid and project_id = p_project_id;
            if not found then raise exception 'Пункт недоступний.'; end if;
            select coalesce(sum(a.amount), 0) into v_paid from public.project_allocations a join public.project_payments r on r.id = a.payment_id
                where a.item_id = v_item.id and a.released_at is null and r.voided_at is null;
            if v_paid + v_amount > v_item.line_total then raise exception 'Сума перевищує залишок за пунктом.'; end if;
        elsif p_action = 'allocate' then raise exception 'Оберіть пункт для зарахування авансу.';
        end if;
        if p_action = 'payment' then
            insert into public.project_payments(project_id, kind, amount, occurred_at, note)
                values(p_project_id, case when v_item.id is null then 'advance' else 'item' end, v_amount, v_date, v_note) returning id into v_id;
            if v_item.id is not null then
                insert into public.project_allocations(project_id, payment_id, item_id, amount, occurred_at) values(p_project_id, v_id, v_item.id, v_amount, v_date);
            end if;
        else
            v_remaining := v_amount;
            for v_source in
                select r.id, r.amount - coalesce((select sum(a.amount) from public.project_allocations a where a.payment_id = r.id and a.released_at is null), 0) available
                from public.project_payments r where r.project_id = p_project_id and r.kind = 'advance' and r.voided_at is null
                order by r.occurred_at nulls first, r.recorded_at, r.id
            loop
                v_part := least(v_source.available, v_remaining);
                if v_part > 0 then
                    insert into public.project_allocations(project_id, payment_id, item_id, amount, occurred_at) values(p_project_id, v_source.id, v_item.id, v_part, v_date);
                    v_remaining := v_remaining - v_part;
                end if;
                exit when v_remaining = 0;
            end loop;
            if v_remaining > 0 then raise exception 'Недостатньо нерозподіленого авансу.'; end if;
        end if;
        v_details := jsonb_build_object('amount', v_amount, 'name', v_item.name, 'payment_id', v_id, 'note', v_note);
    elsif p_action = 'release_advance' then
        select * into v_item from public.project_items where id = (p_payload->>'item_id')::uuid and project_id = p_project_id;
        if not found then raise exception 'Пункт недоступний.'; end if;
        select coalesce(sum(a.amount), 0) into v_amount from public.project_allocations a join public.project_payments r on r.id = a.payment_id
            where a.item_id = v_item.id and a.released_at is null and r.voided_at is null and r.kind = 'advance';
        if v_amount = 0 then raise exception 'У цьому пункті немає зарахованого авансу.'; end if;
        update public.project_allocations a set released_at = now() from public.project_payments r
            where r.id = a.payment_id and r.kind = 'advance' and r.voided_at is null and a.item_id = v_item.id and a.released_at is null;
        v_details := jsonb_build_object('name', v_item.name, 'amount', v_amount);
    elsif p_action = 'void_payment' then
        if btrim(v_note) = '' then raise exception 'Вкажіть причину скасування помилкової оплати.'; end if;
        select * into v_payment from public.project_payments where id = (p_payload->>'payment_id')::uuid and project_id = p_project_id and voided_at is null;
        if not found then raise exception 'Оплата недоступна або вже скасована.'; end if;
        update public.project_payments set voided_at = now(), void_reason = v_note where id = v_payment.id;
        v_details := jsonb_build_object('payment', to_jsonb(v_payment), 'reason', v_note);
    elsif p_action = 'status' then
        if p_payload->>'status' not in ('Очікує старту','В роботі','Завершено') or p_payload->>'status' is null then raise exception 'Некоректний статус.'; end if;
        update public.projects set status = p_payload->>'status' where id = p_project_id;
        v_details := jsonb_build_object('before', v_project.status, 'after', p_payload->>'status');
    else raise exception 'Невідома дія.';
    end if;
    select coalesce(sum(line_total), 0) into v_total from public.project_items where project_id = p_project_id;
    select coalesce(sum(amount), 0) into v_paid from public.project_payments where project_id = p_project_id and voided_at is null;
    if v_total > 9999999999.99 or v_paid > 9999999999.99 then raise exception 'Перевищено максимальну суму проєкту.'; end if;
    update public.projects set total = v_total, paid = v_paid, updated_at = now(), version = version + 1 where id = p_project_id;
    insert into public.project_events(project_id, action, occurred_at, details) values(p_project_id, p_action, v_date, v_details || jsonb_build_object('note', v_note));
    insert into public.project_requests(project_id, request_id, action, payload) values(p_project_id, p_request_id, p_action, p_payload);
    return public.project_detail(p_project_id);
end;
$$;
revoke all on function public.project_detail(uuid) from public, anon, authenticated;
revoke all on function public.project_mutate(uuid,text,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.project_detail(uuid) to authenticated;
grant execute on function public.project_mutate(uuid,text,jsonb,uuid) to authenticated;
commit;
