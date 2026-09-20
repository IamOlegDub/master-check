# My Estimate

A workspace for tradespeople: projects, initial costs and payments, a custom service price list, and PDFs for customers.

## Local setup

1. Install dependencies: `pnpm install`.
2. Copy `.env.example` to `.env.local` and enter your Supabase URL and publishable key.
3. Configure Google Auth in Supabase. Add `http://localhost:3000/auth/callback` to the allowed Redirect URLs.
4. Apply the SQL migrations in `supabase/migrations` in order. See [supabase/README.md](supabase/README.md) for details.
5. Run `pnpm dev` and open `http://localhost:3000`.

## Features

- Google sign-in and access to each user's own data through Supabase RLS.
- Project creation with a client, cost, initial payment, and status.
- Categories and services: creation, editing, deletion, and pricing per unit.
- Search, category filtering, and price list sorting.
- PDF export of the entire price list or the current selection, with Cyrillic support and multipage tables.
- Responsive interface using the Inter font.

Portfolio features and itemized project estimates are not implemented yet.

## Checks

```sh
pnpm test:price-list
pnpm build
```

The installed combination of ESLint 10 and eslint-plugin-react has a `contextOrFilename.getFilename` incompatibility. Running `pnpm lint` requires these dependencies to be aligned separately.

To deploy, add the variables from `.env.example` to your hosting settings and allow your domain's callback URL in Supabase Auth. Secret keys and `.env.local` are not stored in Git.

---

# Мій кошторис

Кабінет майстра: проєкти, початкова вартість та оплата, власний прайс послуг і PDF для замовників.

## Локальний запуск

1. Установіть залежності: `pnpm install`.
2. Скопіюйте `.env.example` у `.env.local` та заповніть URL і publishable key свого Supabase.
3. Налаштуйте Google Auth у Supabase. Додайте `http://localhost:3000/auth/callback` до дозволених Redirect URLs.
4. Застосуйте SQL-міграції з `supabase/migrations` за порядком. Деталі — [supabase/README.md](supabase/README.md).
5. Запустіть `pnpm dev` та відкрийте `http://localhost:3000`.

## Можливості

- Google-вхід і доступ до власних даних через Supabase RLS.
- Створення проєктів із клієнтом, вартістю, початковою оплатою та статусом.
- Категорії та послуги: створення, редагування, видалення, ціна за одиницю.
- Пошук, фільтрація за категоріями та сортування прайсу.
- PDF усього прайсу або поточної вибірки, з кирилицею та багатосторінковими таблицями.
- Адаптивний інтерфейс зі шрифтом Inter.

Портфоліо та деталізація кошторису проєктів ще не реалізовані.

## Перевірки

```sh
pnpm test:price-list
pnpm build
```

Встановлена комбінація ESLint 10 та eslint-plugin-react має несумісність `contextOrFilename.getFilename`. `pnpm lint` потребує окремого узгодження цих залежностей.

Для розгортання додайте змінні з `.env.example` у налаштування хостингу й дозвольте callback вашого домену в Supabase Auth. Секретні ключі та `.env.local` у Git не зберігаються.
