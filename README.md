# My Estimate

A workspace for tradespeople: projects, initial costs and payments, a custom service price list, and PDFs for customers.

Deployment: [Vercel setup guide](docs/DEPLOYMENT.md). Estimate and payment rules: [supabase/README.md](supabase/README.md).

Profile and avatar setup: [Profile settings](docs/PROFILE.md).

UI styles: [Tailwind component guide](docs/STYLING.md). Format components with `pnpm format`.

## Local setup

1. Install dependencies: `pnpm install`.
2. Copy `.env.example` to `.env.local` and enter your Supabase URL and publishable key.
3. Configure Google Auth in Supabase. Add `http://localhost:3000/auth/callback` to the allowed Redirect URLs.
4. Apply the SQL migrations in `supabase/migrations` in order. See [supabase/README.md](supabase/README.md) for details.
5. Run `pnpm dev` and open `http://localhost:3000`.

## Features

- Google sign-in and access to each user's own data through Supabase RLS.
- Projects with a client and status; the total is calculated from estimate items selected from your service price list.
- Categories and services: creation, editing, deletion, and pricing per unit.
- Search, category filtering, and price list sorting.
- PDF export of the entire price list or the current selection, with Cyrillic support and multipage tables.
- Responsive interface using the Inter font.

Estimate items support quantities, frozen unit prices, percentage discounts/surcharges, completion dates, partial payments and separately tracked advances. Advances can be allocated to chosen items without counting money twice. All changes have an event history. Portfolio features are not implemented yet.

## Checks

```sh
pnpm test
pnpm build
```

The installed combination of ESLint 10 and eslint-plugin-react has a `contextOrFilename.getFilename` incompatibility. Running `pnpm lint` requires these dependencies to be aligned separately.

To deploy, add the variables from `.env.example` to your hosting settings and allow your domain's callback URL in Supabase Auth. Secret keys and `.env.local` are not stored in Git.

---

# Мій кошторис

Кабінет майстра: проєкти, початкова вартість та оплата, власний прайс послуг і PDF для замовників.

Деплой: [інструкція Vercel](docs/DEPLOYMENT.md). Правила кошторису й оплат: [supabase/README.md](supabase/README.md).

Профіль і завантаження фото: [налаштування профілю](docs/PROFILE.md).

Стилі інтерфейсу: [Tailwind у компонентах](docs/STYLING.md). Форматування — `pnpm format`.

## Локальний запуск

1. Установіть залежності: `pnpm install`.
2. Скопіюйте `.env.example` у `.env.local` та заповніть URL і publishable key свого Supabase.
3. Налаштуйте Google Auth у Supabase. Додайте `http://localhost:3000/auth/callback` до дозволених Redirect URLs.
4. Застосуйте SQL-міграції з `supabase/migrations` за порядком. Деталі — [supabase/README.md](supabase/README.md).
5. Запустіть `pnpm dev` та відкрийте `http://localhost:3000`.

## Можливості

- Google-вхід і доступ до власних даних через Supabase RLS.
- Проєкти з клієнтом і статусом; вартість формується з пунктів кошторису, вибраних із власного прайсу.
- Категорії та послуги: створення, редагування, видалення, ціна за одиницю.
- Пошук, фільтрація за категоріями та сортування прайсу.
- PDF усього прайсу або поточної вибірки, з кирилицею та багатосторінковими таблицями.
- Адаптивний інтерфейс зі шрифтом Inter.

Пункти кошторису підтримують кількість, збережену ціну за одиницю, знижку/націнку у відсотках, дату виконання, часткові оплати та окремий облік авансів. Аванс можна зарахувати на обрані роботи без подвійного врахування грошей. Зміни мають історію. Портфоліо ще не реалізоване.

## Перевірки

```sh
pnpm test
pnpm build
```

Встановлена комбінація ESLint 10 та eslint-plugin-react має несумісність `contextOrFilename.getFilename`. `pnpm lint` потребує окремого узгодження цих залежностей.

Для розгортання додайте змінні з `.env.example` у налаштування хостингу й дозвольте callback вашого домену в Supabase Auth. Секретні ключі та `.env.local` у Git не зберігаються.
