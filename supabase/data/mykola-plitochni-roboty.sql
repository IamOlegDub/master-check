-- Прайс майстра mykola: категорія «Плиточні роботи».
-- Запуск: Supabase → SQL Editor → New query → вставити весь файл → Run.
-- Скрипт можна запускати повторно: він не створює дублікатів.
--
-- Що робить:
-- 1. Знаходить майстра за username 'mykola' (якщо не знайдено — нічого не змінює).
-- 2. Створює категорію «Плиточні роботи», якщо її ще немає.
-- 3. Для кожної послуги з цього списку шукає в категорії послугу з тією самою назвою
--    (без урахування регістру, пробілів, розділових знаків та х/x/*) і переписує її
--    назву, ціну та одиницю. Дублікати тієї самої послуги в категорії видаляє.
--    Якщо такої послуги немає — додає нову.
-- 4. Інші послуги категорії не чіпає; у результаті вони позначені «ні».
-- Кошториси проєктів не змінюються: вони зберігають власну копію назви та ціни.
-- Діапазон цін: у полі ціни — нижня межа, повний діапазон — у назві.

drop table if exists pg_temp.mykola_tile_prices;
create temp table mykola_tile_prices (
    pos int primary key,
    code text not null, -- номер у початковому списку
    name text not null,
    unit text not null,
    price numeric(12,2) not null,
    source_name text -- назва з початкового списку, якщо вона відрізняється
);

insert into pg_temp.mykola_tile_prices(pos, code, name, unit, price, source_name) values
    (1,  '1',  'Укладка плитки на стіни/підлогу кабанчик 10*20/10*30', 'm2', 1000, null),
    (2,  '2',  'Укладка плитки на стіни/підлогу 30х30', 'm2', 650, null),
    (3,  '3',  'Укладка плитки на стіни/підлогу 60х60', 'm2', 700, null),
    (4,  '4',  'Укладка плитки на стіни/підлогу 120х60', 'm2', 800, null),
    (5,  '5',  'Укладання плитки на стіни/підлогу 30*60', 'm2', 650, null),
    (6,  '6',  'Укладання плитки типу Паркет', 'm2', 750, null),
    (7,  '7',  'Укладання плитки дошка до 120 см', 'm2', 900, null),
    (8,  '8',  'Укладання плитки на сходи - прямі', 'lm', 650, null),
    (9,  '9',  'Улаштування фриза з плитки (плінтус)', 'lm', 300, null),
    (10, '10', 'Монтаж фартуха з плитки, кухня (від 650 ₴)', 'lm', 650, 'Монтаж фартуха з плитки (кухня) ціна від...'),
    (11, '11', 'Закладення штроб', 'lm', 150, null),
    (12, '12', 'Зарізка під "кут 45" 1 сторона', 'lm', 270, null),
    (13, '13', 'Вирізання отворів в керам. плитці (100–250 ₴)', 'piece', 100, 'Вирізання отворів в керам. плитці'),
    (14, '14', 'Вирізання отворів в керамограніті (200–300 ₴)', 'piece', 200, 'Вирізання отворів в керамограніті'),
    (15, '15', 'Монтаж кутника під плитку', 'lm', 100, null),
    (16, '16', 'Грунтування поверхні', 'm2', 35, null),
    -- №17 у списку має дві одиниці (кв.м./пог.м), тому це дві послуги.
    (17, '17', 'Нанесення гідроізоляції 1 р.', 'm2', 120, 'Нанесення гідроізоляціїї 1р./кути стрічка'),
    (18, '17', 'Гідроізоляція кутів стрічкою', 'lm', 150, null),
    (19, '18', 'Фугування плитки звичайна цементна', 'm2', 120, null),
    (20, '19', 'Фугування плитки епоксидна', 'm2', 220, null),
    (21, '20', 'Різ плитки чистовий зі шліфуванням', 'lm', 220, null),
    (22, '21', 'Відкоси з плитки', 'lm', 550, null),
    (23, '22', 'Виготовлення полички з плитки (2000–5000 ₴)', 'piece', 2000, 'Виготовлення полички з плитки'),
    (24, '23', 'Монтаж прихованої вентиляції/люк ревізії ванни (2000–5000 ₴)', 'piece', 2000, 'Монтаж прихованої вентиляції/люк ревізії ванни'),
    (25, '24', 'Формування кутів з епоксидки', 'lm', 250, null),
    (26, '25', 'Виготовлення душового піддону в комплекті, з бортами чи без (8000–13000 ₴)', 'piece', 8000, 'Виготовлення душового підону в комплекті(в залежності з бортами чи без)'),
    (27, '26', 'Герметизація кутів силіконом', 'lm', 150, null),
    (28, '27', 'Зашивка інсталяції г/к в 2 шари', 'piece', 2500, null),
    (29, '28', 'Встановлення ванни/підключення сифону', 'piece', 2200, null),
    (30, '29', 'Улаштування екрану ванни з облицюванням', 'piece', 3500, null);

do $$
declare
    v_user uuid;
    v_category uuid;
    v_service uuid;
    v_touched uuid[] := '{}';
    r record;
begin
    select user_id into v_user from public.accounts where username = 'mykola';
    if v_user is null then
        raise exception 'Майстра з username mykola не знайдено в public.accounts. Нічого не змінено.';
    end if;

    insert into public.service_categories(user_id, name) values (v_user, 'Плиточні роботи')
        on conflict (user_id, lower(name)) do nothing;
    select id into v_category from public.service_categories
        where user_id = v_user and lower(name) = lower('Плиточні роботи');

    for r in
        select t.*, array_remove(array[
            regexp_replace(translate(lower(t.name), 'x×*', 'ххх'), '[\s[:punct:]«»–—’ʼ°₴]+', '', 'g'),
            regexp_replace(translate(lower(t.source_name), 'x×*', 'ххх'), '[\s[:punct:]«»–—’ʼ°₴]+', '', 'g')
        ], null) as match_keys
        from pg_temp.mykola_tile_prices t order by t.pos
    loop
        -- Найдавніша послуга з такою назвою переписується, решта таких самих — дублікати.
        select s.id into v_service from public.services s
            where s.user_id = v_user and s.category_id = v_category and s.id <> all(v_touched)
              and regexp_replace(translate(lower(s.name), 'x×*', 'ххх'), '[\s[:punct:]«»–—’ʼ°₴]+', '', 'g') = any(r.match_keys)
            order by s.created_at, s.id limit 1;

        if v_service is null then
            insert into public.services(user_id, category_id, name, price, unit)
                values (v_user, v_category, r.name, r.price, r.unit)
                returning id into v_service;
        else
            update public.services set name = r.name, price = r.price, unit = r.unit where id = v_service;
            delete from public.services s
                where s.user_id = v_user and s.category_id = v_category and s.id <> v_service and s.id <> all(v_touched)
                  and regexp_replace(translate(lower(s.name), 'x×*', 'ххх'), '[\s[:punct:]«»–—’ʼ°₴]+', '', 'g') = any(r.match_keys);
        end if;
        v_touched := v_touched || v_service;
    end loop;
end $$;

-- Результат: усі послуги категорії. «ні» — стара позиція, якої немає в новому списку.
select coalesce(t.code, '—') as "№",
       s.name as "Послуга",
       s.unit as "Од.",
       s.price as "Ціна",
       case when t.pos is null then 'ні' else 'так' end as "У новому прайсі"
from public.services s
join public.service_categories c on c.id = s.category_id and c.user_id = s.user_id
join public.accounts a on a.user_id = s.user_id
left join pg_temp.mykola_tile_prices t on t.name = s.name and t.unit = s.unit and t.price = s.price
where a.username = 'mykola' and lower(c.name) = lower('Плиточні роботи')
order by t.pos nulls last, s.name;
