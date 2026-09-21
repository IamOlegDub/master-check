# Profile settings / Налаштування профілю

Open the account menu → Settings (`/settings`). First name and email are required; last name, contact phone and bio are optional. Profile fields are stored in the authenticated user's `mastercheck_profile` Auth metadata, separately from Google metadata. They are not authorization claims. Email is the real Auth email; changes use Supabase confirmation, and the old address remains active until confirmed. The phone is a contact field, not a verified login method.

## Supabase setup

Run `supabase/migrations/202609210001_profile_avatars.sql` in Supabase → SQL Editor once. This creates the `avatars` bucket (public image URLs, 2 MB upload limit, JPG/PNG/WebP) and owner-only upload/read-object/delete policies. The app generates unique file paths under the authenticated user's ID. No service-role key is needed. Profile text works without this migration; photo uploads require it.

Keep the deployed and localhost `/auth/callback` URLs in Authentication → URL Configuration → Redirect URLs. Keep secure email change enabled. Confirmation emails normally go to both old and new addresses. Use the existing PKCE callback email template / redirect configuration; test delivery with your Supabase email provider before relying on email changes in production.

Photos: input JPG/PNG/WebP up to 10 MB → touch/keyboard crop using react-easy-crop → square image up to 768×768 → WebP quality 0.85 (PNG fallback in browsers without WebP encoding). The original is never uploaded. The round crop guide is used in menus, the same image is displayed as a rectangular mobile profile hero. Old uploaded images are removed only after a successful profile update. If a network failure leaves an unreferenced image, it can be cleaned up later; the app does not delete an upload after an ambiguous save result.

Confirm the crop, then use **Save photo** next to the preview. This saves only the avatar, preserving unsaved text fields. Removing a photo also requires confirmation. **Save profile** saves all current changes. Profile, account menu and crop dialog use Tailwind utilities; only the mobile photo panel has square corners.

## Українською

Натисніть аватар → **Налаштування**. Обов’язкові ім’я та email. Прізвище, контактний телефон і опис — необов’язкові. Дані зберігаються в Supabase Auth, окремо від полів Google. Зміна email потребує підтвердження; телефон поки не використовується для входу.

**Для фото:** відкрийте Supabase → SQL Editor, вставте весь файл `supabase/migrations/202609210001_profile_avatars.sql` і натисніть Run. Ця міграція створює сховище та права доступу. Фото доступні за публічними URL; завантажувати та видаляти їх може лише власник. Додавати нові env не потрібно.

У Redirect URLs залиште адреси `/auth/callback` для Vercel та localhost. Після зміни email перевірте стару й нову пошту. Не вимикайте підтвердження для спрощення тестування.

Фото можна пересувати та масштабувати перед збереженням. Зберігається оптимізована версія до 768×768. На мобільному фото займає приблизно третину висоти екрана під хедером, на десктопі показується круглим портретом поруч із формою.

Натисніть **Підтвердити кадрування**, потім **Зберегти фото** біля аватара. Фото зберігається окремо, без зміни незбережених текстових полів. Видалення також потребує підтвердження. Форма, меню та редактор оформлені через Tailwind. Прямі кути на мобільному застосовані лише до блоку аватара.

Можливі наступні поля: місто та радіус виїзду, назва майстерні, посилання на портфоліо, контакти для PDF. Вони поки не додані до форми.
