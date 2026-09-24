# Workspace MVP / Робочий простір

## English

Apply unapplied SQL migrations in filename order before deploying this version. The latest is `202609240001_readable_urls_and_media.sql`; it requires both `202609230001_collaboration.sql` and `202609230002_portfolio.sql`, plus the earlier project, price-list, estimate and avatar migrations. Do not rerun migrations already applied. No additional environment variables are needed.

Existing accounts retain the MASTER role and choose a unique username at their next sign-in. New accounts choose MASTER or CLIENT. A project invitation creates the CLIENT role if no role has been selected. Roles and usernames cannot be changed through the app. Google authentication remains enabled; phone numbers are contact information, not a login method.

Projects open at `/<master-username>/<project-slug>`, for example `/ivan-maister/vul-mazepy-21`. Ukrainian titles are transliterated automatically. A unique database constraint prevents duplicate slugs within one owner's workspace, including simultaneous submissions. Different masters may use the same project title. Existing duplicates receive suffixes during migration; old `/projects/<uuid>` links redirect to the readable address. These URLs do not make projects public.

The project has four tabs: Estimate, Work, Payments and Access. Item and payment forms open in accessible dialogs. Record completed quantities and photos under Work after the customer approves the estimate. A submitted report contributes to the financial balance only after the invited customer confirms it. Returned reports stay in history; a corrected report is submitted separately. Confirmed and submitted quantities cannot exceed the planned quantity.

`DRAFT → PENDING_APPROVAL → IN_PROGRESS → COMPLETED`. The customer can return an estimate with a comment. A master can open a new revision when there are no pending reports; another customer approval is then required. Items with report history cannot be rewritten or deleted. Add a new item for additional work. Completion requires confirmation of all planned quantities.

Current balance = confirmed report amounts − non-voided payments. A negative balance is customer credit toward future work. Advances remain separate until the master allocates them to chosen items; allocation never counts as a new payment. The remaining planned amount is shown separately. Existing money and historical completion flags are preserved, but old flags are not fabricated customer confirmations. Dates are stored as timestamps; displayed dates use Kyiv time consistently to avoid server/browser hydration mismatches. Date/time input uses the device's local time.

Clients are private contact cards with name, phone, notes and project links. A contact card does not grant access: use a seven-day, single-use invitation from Access. Generating another invite revokes the previous unused one. Share controls open Telegram, Viber, SMS or the device share dialog; nothing is sent automatically.

Portfolio albums are private until published. Album and whole-portfolio URLs stay the same when hidden and republished. A whole-portfolio link shows only published albums. Photo menus support individual deletion and a confirmation dialog for deleting all photos in an album. Project report photos remain part of the audit history.

Photo input limit: 10 MB each, 10 files per upload. The browser downscales to 2048 px and produces WebP (PNG fallback), up to 5 MB stored per photo. Each project or album has one optional overview video, MP4/H.264 or WebM up to 50 MB. Uploading another replaces it. Videos are not transcoded. Files live in private Supabase Storage buckets; database rows contain paths and metadata. Signed photo links expire after five minutes, video links after one hour. Hiding an album prevents new access, but previously issued links can last until expiry.

The PWA can be installed from the browser or Settings. It requires an internet connection for workspace data. The service worker caches only the offline page and icons, not private pages, photos or financial data. Chat and AI estimate recognition remain Phase 2.

## Українською

### Оновлення бази

У **Supabase → SQL Editor → New query** виконайте лише ще не застосовані файли, за порядком:

1. `202609230001_collaboration.sql` — ролі, клієнти, запрошення, погодження та звіти.
2. `202609230002_portfolio.sql` — альбоми й фото портфоліо.
3. `202609240001_readable_urls_and_media.sql` — username, адреси проєктів, виправлення доступу до завантаження фотозвітів, стабільні публічні посилання й оглядові відео.

Вони потребують попередніх міграцій із каталогу `supabase/migrations`, включно з аватарками. Якщо перші два файли вже виконані, запускайте лише третій. Раніше застосовані міграції повторювати не потрібно. Нових env-змінних немає; Storage buckets і політики створюються SQL-міграціями. Хмарна база не змінюється запуском локальних тестів.

### Як користуватися

Існуючі акаунти залишаються майстрами. Після оновлення майстер один раз обирає вільний username: 3–30 символів, латиниця, цифри та дефіс, початок — літера. Зарезервовані адреси застосунку та зайняті імена недоступні. Username не змінюється, щоб надіслані адреси працювали. Новий користувач обирає роль; прийняття запрошення без обраної ролі створює акаунт замовника. Для тестування обох ролей використовуйте два Google-акаунти. Телефон поки є контактним полем, а не способом входу.

Проєкт має адресу `/<username>/<назва-латинкою>`, наприклад `/ivan-maister/vul-mazepy-21`. Транслітерація автоматична. Дублі однакової адреси всередині одного майстра заборонені в базі, включно з одночасними запитами. Різні майстри можуть мати проєкти з однаковою назвою. Старим дублікатам міграція додає числові суфікси, старі UUID-посилання переадресовують на нові. Знання адреси не надає доступу до проєкту.

- **Кошторис:** роботи зі свого прайсу, обсяги, зафіксовані ціни, знижки й націнки. Редагування в модальному вікні.
- **Доступ:** контакт клієнта, одноразове запрошення на сім днів, погодження кошторису. Нове запрошення скасовує попереднє невикористане. Картка контакту сама по собі не надає доступу.
- **Виконання:** після затвердження кошторису майстер натискає «Зафіксувати виконання / фото», вводить фактичний обсяг, дату, коментар і фото. Можна зазначити весь залишок або частину. Замовник підтверджує звіт чи повертає з коментарем. Повернуті звіти залишаються в історії; виправлений звіт подається окремо.
- **Оплати:** аванси, часткові й повні оплати, зарахування авансів та виправлення помилкових записів. Форми відкриваються по центру екрана.

Статуси: `DRAFT → PENDING_APPROVAL → IN_PROGRESS → COMPLETED`. Для завершення потрібні підтвердження всіх планових обсягів. Майстер не може підтвердити звіт замість замовника. Нову редакцію можна відкрити, коли немає неперевірених звітів; після цього потрібне повторне погодження. Пункт з історією звітів не можна переписати чи видалити — додайте нову роботу.

**Поточний баланс = підтверджені роботи − отримані оплати.** Мінус означає кошти замовника в рахунок майбутніх робіт. Аванс спочатку ведеться окремо; зарахування на пункт не збільшує отриману суму повторно. Залишок за всім планом показується окремо. Старі суми й позначки виконання зберігаються, але не перетворюються на вигадані підтвердження замовника. Усі дати показуються за Києвом; введення дати/часу — у часовому поясі пристрою.

### Портфоліо, фото й відео

Альбоми приватні до публікації. Посилання альбому та всього портфоліо не змінюється після приховування й повторної публікації. Загальне посилання показує лише опубліковані альбоми. Надсилання в Telegram/Viber/SMS відбувається тільки після дії користувача.

На мініатюрі фото є меню «⋮ → Видалити», у великому перегляді — іконка кошика. «Видалити всі фото» потребує підтвердження та залишає альбом і відео. Фото надісланих робочих звітів зберігаються як частина історії погоджень.

Вхідне фото — до **10 МБ**, до десяти за раз. Перед відправленням воно оптимізується до 2048 px у WebP (або PNG), у Storage зберігається копія до 5 МБ. Оригінал до бази не відправляється. Кожен проєкт і кожен альбом може мати **одне оглядове відео до 50 МБ**, MP4/H.264 або WebM. Новий файл замінює попередній; автоматичного перекодування відео немає.

Файли зберігаються в приватних buckets `reports`, `portfolio`, `overview-video`; у таблицях — адреси та метадані. Виданий підписаний URL фото діє до п’яти хвилин, відео — до години. Після приховування нові посилання недоступні, але вже видані можуть працювати до завершення строку.

### PWA та межі MVP

Застосунок встановлюється з меню браузера або через інструкцію в Налаштуваннях. Для даних потрібен інтернет. Офлайн кешуються лише сторінка відсутності з’єднання й іконки; приватні дані та фінанси не кешуються. Чат і AI-розпізнавання кошторисів залишаються Phase 2.

### Перевірка після міграції

1. Майстер обирає username, створює послугу й проєкт, додає 400 м² × 400 грн.
2. Інший Google-акаунт приймає запрошення як замовник і погоджує кошторис.
3. Майстер додає звіт на 50 м² із фото. Замовник підтверджує: виконано на 20 000 грн.
4. Майстер вносить аванс 15 000 грн: поточний баланс 5 000 грн, залишок за планом 145 000 грн.
5. Перевірте пряме відкриття адреси проєкту, перезавантаження, приватність з третього акаунта, портфоліо без входу, приховування та повторну публікацію за тим самим URL, фото й оглядове відео.
