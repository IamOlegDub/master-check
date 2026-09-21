# Deploy to Vercel / Деплой на Vercel

## English

Vercel supports this Next.js app and provides an available `your-name.vercel.app` address. A custom domain can be connected later. Hobby is for personal, non-commercial use; commercial use requires an appropriate paid plan. See https://vercel.com/docs/plans/hobby.

1. Sign in at https://vercel.com using GitHub.
2. Choose **Add New → Project**, grant access to `IamOlegDub/master-check`, then **Import**.
3. Set the project name, **Framework Preset: Next.js**, **Root Directory: ./**. Keep the default install/build/output settings; the repository uses pnpm and `pnpm build`. Node 22 is specified in `package.json`.
4. Under **Environment Variables**, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, using values from `.env.local` or Supabase → Connect. Use the publishable key, not a secret/service-role key. Enable the Production environment. If adding Preview access, configure its callback URL separately.
5. Select **Deploy**. Copy the stable production URL from **Settings → Domains**, not a temporary preview URL. Choose a different available name if needed.
6. In Supabase **Authentication → URL Configuration**, set **Site URL** to `https://YOUR-NAME.vercel.app` and add `https://YOUR-NAME.vercel.app/auth/callback` under **Redirect URLs**. Keep `http://localhost:3000/auth/callback` for local development.
7. The Google OAuth authorized redirect URI remains the Supabase callback: `https://PROJECT-REF.supabase.co/auth/v1/callback`. If you configure authorized JavaScript origins, add the production origin there.
8. In Supabase SQL Editor, run only unapplied migrations from `supabase/migrations`, in order: `202609200001_create_projects.sql`, `202609200002_create_price_list.sql`, `202609200003_project_estimates.sql`. Do not rerun already applied migrations.
9. Verify Google login, project creation, an estimate item, an advance/payment and PDF export on the published site. The third migration preserves old project amounts as a legacy estimate item and old payments as unallocated credit with an explicitly unknown original date.

New pushes to the production branch `master` deploy automatically. Environment variable changes require a new deployment: **Deployments → Redeploy**. Confirm the production branch under project settings if Vercel did not select `master` automatically.

### Custom domain later

Buy the domain separately, add it under **Settings → Domains**, and enter the DNS records Vercel displays. Set it as the main domain and wait for HTTPS. Update Supabase Site URL and callbacks and Google OAuth origins. Your data remains in the same Supabase database.

## Українською

Vercel підтримує цей Next.js-застосунок і дає вільну адресу `ваша-назва.vercel.app`. Власний домен можна підключити згодом. Hobby призначений для особистого некомерційного використання; комерційна робота потребує відповідного платного тарифу. Умови: https://vercel.com/docs/plans/hobby.

1. Увійдіть на https://vercel.com через GitHub.
2. **Add New → Project**, дозвольте доступ до `IamOlegDub/master-check` та натисніть **Import**.
3. Задайте назву проєкту, **Framework Preset: Next.js**, **Root Directory: ./**. Налаштування встановлення, збірки й вихідної папки залиште стандартними: проєкт використовує pnpm та `pnpm build`. Node 22 указаний у `package.json`.
4. У **Environment Variables** додайте `NEXT_PUBLIC_SUPABASE_URL` та `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` зі свого `.env.local` або Supabase → Connect. Потрібен publishable key, а не secret/service-role. Увімкніть середовище Production. Для Preview адреси callback налаштовуються окремо.
5. Натисніть **Deploy**. Постійна адреса сайту буде у **Settings → Domains**. Використовуйте її, а не тимчасову preview-адресу. Якщо назва зайнята, оберіть іншу.
6. У Supabase → **Authentication → URL Configuration** встановіть **Site URL** на `https://ВАША-НАЗВА.vercel.app`. У **Redirect URLs** додайте `https://ВАША-НАЗВА.vercel.app/auth/callback`. Залиште `http://localhost:3000/auth/callback` для локальної розробки.
7. Google OAuth redirect URI залишається адресою Supabase: `https://PROJECT-REF.supabase.co/auth/v1/callback`. Якщо налаштовуєте JavaScript origins, додайте туди адресу опублікованого сайту.
8. У Supabase → SQL Editor виконайте лише ще не застосовані міграції за порядком: `202609200001_create_projects.sql`, `202609200002_create_price_list.sql`, `202609200003_project_estimates.sql`. Уже виконані повторно не запускайте.
9. На опублікованому сайті перевірте Google-вхід, створення проєкту, пункт кошторису, аванс/оплату та PDF. Третя міграція зберігає старі суми як початковий пункт кошторису, а старі оплати — як нерозподілений залишок із невідомою історичною датою.

Push у production-гілку `master` запускає автоматичний деплой. Після зміни env потрібен новий деплой: **Deployments → Redeploy**. Якщо Vercel не вибрав `master` автоматично, задайте production-гілку в налаштуваннях проєкту.

### Власний домен пізніше

Придбайте домен окремо, додайте його в **Settings → Domains** і внесіть DNS-записи, які покаже Vercel. Зробіть домен основним та дочекайтеся HTTPS. Оновіть Site URL і callback у Supabase, а також origins у Google OAuth. База залишається тією самою, переносити дані не потрібно.
