'use client';
import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { inputClass, message } from '@/lib/workspace';
import { BusyIndicator } from '@/components/feedback';
export function RoleChoice({ existingMaster = false }: { existingMaster?: boolean }) {
    const [busy, setBusy] = useState(false),
        [error, setError] = useState(''),
        [master, setMaster] = useState(existingMaster),
        [username, setUsername] = useState(''),
        [availability, setAvailability] = useState('');
    useEffect(() => {
        if (!username) {
            setAvailability('');
            return;
        }
        setAvailability('Перевіряємо…');
        let active = true;
        const timer = setTimeout(() => {
            void createSupabaseBrowserClient()
                ?.rpc('username_available', { p_username: username })
                .then((r) => {
                    if (active)
                        setAvailability(
                            r.error
                                ? 'Перевірка недоступна. Спробуйте зберегти.'
                                : r.data
                                  ? 'Вільний username'
                                  : 'Зайнятий або недопустимий username',
                        );
                });
        }, 400);
        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [username]);
    async function choose(role: string) {
        setBusy(true);
        try {
            const c = createSupabaseBrowserClient();
            if (!c) throw Error('Немає з’єднання.');
            const r =
                role === 'MASTER'
                    ? await c.rpc('register_master', { p_username: username })
                    : await c.rpc('choose_role', { p_role: role });
            if (r.error) throw r.error;
            window.location.assign('/');
        } catch (e) {
            setError(message(e));
            setBusy(false);
        }
    }
    return (
        <main className="mx-auto max-w-xl p-6 py-16">
            <h1 className="text-3xl font-semibold">
                {master ? 'Оберіть адресу майстра' : 'Як ви користуватиметеся застосунком?'}
            </h1>
            <p className="my-5 text-subtle">
                {master
                    ? 'Username допоможе впізнавати ваші проєкти за посиланням.'
                    : 'Якщо майстер надіслав запрошення, відкрийте його або оберіть роль замовника.'}
            </p>
            <div className="grid gap-4">
                {master ? (
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            void choose('MASTER');
                        }}
                        className="rounded-2xl border border-line bg-card p-6"
                    >
                        <label className="font-semibold">
                            Ваш username
                            <input
                                value={username}
                                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                                required
                                minLength={3}
                                maxLength={30}
                                pattern="[a-z][a-z0-9-]{2,29}"
                                className={inputClass}
                                placeholder="ivan-maister"
                                disabled={busy}
                            />
                        </label>
                        <p className="mt-2 text-xs text-subtle">
                            3–30 символів: латинські літери, цифри й дефіс. Початок — літера.
                            Username стане частиною адреси ваших проєктів і залишиться незмінним.
                        </p>
                        <p role="status" className="my-3 text-sm text-brand">
                            {availability}
                        </p>
                        <button
                            disabled={busy}
                            className="rounded-xl bg-[var(--brand-solid)] px-5 py-3 text-white disabled:opacity-50"
                        >
                            {busy ? 'Зберігаємо…' : 'Продовжити'}
                        </button>
                        {!existingMaster && (
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => setMaster(false)}
                                className="ml-4 text-subtle"
                            >
                                Назад
                            </button>
                        )}
                    </form>
                ) : (
                    <>
                        {[
                            ['MASTER', 'Я майстер', 'Створюю кошториси, веду роботи та оплату.'],
                            [
                                'CLIENT',
                                'Я замовник',
                                'Переглядаю запрошені проєкти та підтверджую роботи.',
                            ],
                        ].map(([role, label, hint]) => (
                            <button
                                key={role}
                                disabled={busy}
                                onClick={() =>
                                    role === 'MASTER' ? setMaster(true) : void choose(role)
                                }
                                className="rounded-2xl border border-line bg-card p-6 text-left hover:border-brand disabled:opacity-50"
                            >
                                <strong className="text-lg">{label}</strong>
                                <span className="mt-2 block text-subtle">{hint}</span>
                            </button>
                        ))}
                    </>
                )}
            </div>
            <BusyIndicator busy={busy} label="Створюємо ваш робочий простір…" />
            {error && (
                <p role="alert" className="mt-4 text-red-700 dark:text-red-300">
                    {error}
                </p>
            )}
        </main>
    );
}
