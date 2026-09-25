# My Estimate

A workspace for tradespeople and customers: estimates, approved work reports, payments, service price lists, contacts and public portfolios.

Deployment: [Vercel setup guide](docs/DEPLOYMENT.md). Estimate and payment rules: [supabase/README.md](supabase/README.md).

Profile and avatar setup: [Profile settings](docs/PROFILE.md).

UI styles: [Tailwind component guide](docs/STYLING.md). Format components with `pnpm format`.

## Local setup

1. Install dependencies: `pnpm install`.
2. Copy `.env.example` to `.env.local` and enter your Supabase URL and publishable key.
3. Configure Google Auth in Supabase. Add `http://localhost:3000/auth/callback` to the allowed Redirect URLs.
4. Apply the SQL migrations in `supabase/migrations` in order. See [supabase/README.md](supabase/README.md) for details.
5. Run `pnpm dev` and open `http://localhost:3000`.

If local Google sign-in returns to the deployed site, follow [Local auth setup](docs/LOCAL_AUTH.md). Appearance (light, dark, system) is available on the login screen and in profile settings; the preference is saved in this browser.

## Features

- Google sign-in and access to each user's own data through Supabase RLS.
- Projects with a client and status; the total is calculated from estimate items selected from your service price list.
- Categories and services: creation, editing, deletion, and pricing per unit.
- Search, category filtering, and price list sorting.
- PDF export of the entire price list or the current selection, with Cyrillic support and multipage tables.
- Responsive interface using the Inter font.

Estimate items support quantities, frozen unit prices, percentage discounts/surcharges, completion dates, partial payments and separately tracked advances. Advances can be allocated to chosen items without counting money twice. All changes have an event history. Projects have separate Estimate, Work, Payments and Access tabs, readable /username/project-slug URLs, customer approvals, photo reports and one overview video. Portfolio albums support stable public links. The app includes mobile navigation, loading states, custom error pages and installable PWA support. See [Workspace setup and workflows](docs/WORKSPACE.md); apply migration 202609240001 before deploying this update.

## Checks

```sh
pnpm test
pnpm build
```

The installed combination of ESLint 10 and eslint-plugin-react has a `contextOrFilename.getFilename` incompatibility. Running `pnpm lint` requires these dependencies to be aligned separately.

To deploy, add the variables from `.env.example` to your hosting settings and allow your domain's callback URL in Supabase Auth. Secret keys and `.env.local` are not stored in Git.

---

# Мій кошторис

Робочий простір майстра й замовника: кошториси, погодження виконаних робіт, оплати, прайс послуг, контакти та публічне портфоліо.

Деплой: [інструкція Vercel](docs/DEPLOYMENT.md). Правила кошторису й оплат: [supabase/README.md](supabase/README.md).

Профіль і завантаження фото: [налаштування профілю](docs/PROFILE.md).

Стилі інтерфейсу: [Tailwind у компонентах](docs/STYLING.md). Форматування — `pnpm format`.

## Локальний запуск

1. Установіть залежності: `pnpm install`.
2. Скопіюйте `.env.example` у `.env.local` та заповніть URL і publishable key свого Supabase.
3. Налаштуйте Google Auth у Supabase. Додайте `http://localhost:3000/auth/callback` до дозволених Redirect URLs.
4. Застосуйте SQL-міграції з `supabase/migrations` за порядком. Деталі — [supabase/README.md](supabase/README.md).
5. Запустіть `pnpm dev` та відкрийте `http://localhost:3000`.

Якщо Google-вхід із localhost повертає на деплой, дивіться [налаштування локального входу](docs/LOCAL_AUTH.md). Світла, темна та системна теми доступні на сторінці входу й у налаштуваннях профілю; вибір зберігається в цьому браузері.

## Можливості

- Google-вхід і доступ до власних даних через Supabase RLS.
- Проєкти з клієнтом і статусом; вартість формується з пунктів кошторису, вибраних із власного прайсу.
- Категорії та послуги: створення, редагування, видалення, ціна за одиницю.
- Пошук, фільтрація за категоріями та сортування прайсу.
- PDF усього прайсу або поточної вибірки, з кирилицею та багатосторінковими таблицями.
- Адаптивний інтерфейс зі шрифтом Inter.

Пункти кошторису підтримують кількість, збережену ціну за одиницю, знижку/націнку у відсотках, дату виконання, часткові оплати та окремий облік авансів. Аванс можна зарахувати на обрані роботи без подвійного врахування грошей. Зміни мають історію. Проєкт має вкладки «Кошторис», «Виконання», «Оплати» та «Доступ», адресу /username/назва-латинкою, погодження замовником, фотозвіти й оглядове відео. Альбоми портфоліо мають стабільні публічні посилання. Є мобільна навігація, індикатори завантаження, власні сторінки помилок і встановлення як PWA. [Налаштування й сценарії роботи](docs/WORKSPACE.md); перед деплоєм цього оновлення застосуйте міграцію 202609240001.

## Перевірки

```sh
pnpm test
pnpm build
```

Встановлена комбінація ESLint 10 та eslint-plugin-react має несумісність `contextOrFilename.getFilename`. `pnpm lint` потребує окремого узгодження цих залежностей.

Для розгортання додайте змінні з `.env.example` у налаштування хостингу й дозвольте callback вашого домену в Supabase Auth. Секретні ключі та `.env.local` у Git не зберігаються.
