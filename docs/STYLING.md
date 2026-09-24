# Tailwind styling

All application screens use Tailwind utilities in JSX. Edit the relevant component:

- `src/components/workspace-shell.tsx`: sidebar, header, breadcrumbs and fixed bottom navigation.
- `src/components/workspace-home.tsx`: project list and summary.
- `src/components/project-workspace.tsx`: project tabs, approvals and work reports.
- `src/components/action-modal.tsx`, `feedback.tsx`: dialogs, confirmations, request indicators and skeletons.
- `src/components/photo-gallery.tsx`, `overview-video.tsx`, `portfolio-manager.tsx`: media and portfolio controls.
- `src/components/price-list.tsx`: service catalogue, categories and PDF options.
- `src/components/project-estimate.tsx`: estimate items, payments and history.
- `src/components/login-screen.tsx`: Google sign-in screen.
- `src/components/profile-settings.tsx`, `avatar-editor.tsx`, `account-menu.tsx`: profile and avatar controls.
- `src/components/ui/button.tsx`: shared button variants, including `variant="brand"`.
- `src/components/profile-styles.ts`: shared Tailwind strings for profile fields and buttons.

`src/app/globals.css` only defines Tailwind imports, theme tokens and base rules. Application-specific class selectors do not belong there. Semantic class names retained in JSX are hooks for local descendant utilities and UI checks, not global CSS definitions.

Theme colours are exposed as `text-ink`, `text-subtle`, `border-line`, `bg-brand`, etc. Change the corresponding custom properties in `:root` for an application-wide colour change.

Responsive utilities preserve the existing layout: the sidebar starts at 1024px; smaller viewports use fixed bottom navigation. Service rows become cards below 761px. Safe-area padding is preserved for phones. Project completion uses native progress elements with Tailwind styling.

Use `pnpm format` after editing and `pnpm format:check` to check formatting. Validate changes with `pnpm test` and `pnpm build`.

## Українською

Стилі екранів розташовані в `className` біля JSX. У `globals.css` залишаються тільки тема, імпорти та базові правила. Основні кольори: `text-ink`, `text-subtle`, `border-line`, `bg-brand`. Спільна акцентна кнопка — `<Button variant="brand">`.

Для зміни вигляду відкрийте потрібний компонент зі списку вище. Після редагування запустіть `pnpm format`; перевірки — `pnpm test` і `pnpm build`.
