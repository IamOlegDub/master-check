# Localhost and production sign-in / Вхід локально й на Vercel

In Supabase → **Authentication → URL Configuration**:

- Keep **Site URL** set to your production URL.
- Add each allowed callback as a separate **Redirect URLs** entry:
  - `http://localhost:3000/auth/callback`
  - `http://127.0.0.1:3000/auth/callback` (if you use this host)
  - `https://YOUR-NAME.vercel.app/auth/callback`
- Save changes. Do not enter multiple URLs separated by commas.

У Supabase → **Authentication → URL Configuration** залиште **Site URL** адресою продакшну.
У **Redirect URLs** додайте наведені вище callback-адреси окремими записами, замінивши домен Vercel своїм, та збережіть.
Після цього починайте вхід із `http://localhost:3000/login`.

The application sends the exact current-origin `/auth/callback` URL, without query parameters.
The intended local page is kept in a short-lived, same-site cookie, validated after sign-in and then deleted.
Google's authorized redirect URI remains the Supabase Auth callback; do not replace it with localhost.

Застосунок повертає користувача на той хост, з якого почався вхід. Недозволена callback-адреса може призвести до повернення на Site URL.
Це налаштування Supabase не змінює доступ до бази даних для локальної розробки.

Reference: https://supabase.com/docs/guides/auth/redirect-urls
