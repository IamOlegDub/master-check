'use client';
import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { message } from '@/lib/workspace';
export function AcceptInvite({ token }: { token: string }) {
    const [busy, setBusy] = useState(false),
        [error, setError] = useState('');
    async function accept() {
        setBusy(true);
        try {
            const c = createSupabaseBrowserClient();
            if (!c) throw Error('Немає з’єднання.');
            const r = await c.rpc('accept_invite', { p_token: token });
            if (r.error) throw r.error;
            window.location.assign(`/projects/${r.data}`);
        } catch (e) {
            setError(message(e));
            setBusy(false);
        }
    }
    async function switchAccount() {
        setBusy(true);
        try {
            const c = createSupabaseBrowserClient();
            if (!c) throw Error('Немає з’єднання.');
            const r = await c.auth.signOut();
            if (r.error) throw r.error;
            window.location.assign(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
        } catch (e) {
            setError(message(e));
            setBusy(false);
        }
    }
    return (
        <main className="mx-auto max-w-lg p-6 py-16">
            <h1 className="text-2xl font-semibold">Запрошення до проєкту</h1>
            <p className="my-5">
                Прийміть запрошення, щоб переглядати кошторис, фото й оплати та підтверджувати
                виконані роботи.
            </p>
            <button
                disabled={busy}
                onClick={() => void accept()}
                className="rounded-xl bg-[var(--brand-solid)] p-3 text-white disabled:opacity-50"
            >
                {busy ? 'Підключаємо…' : 'Прийняти як замовник'}
            </button>
            {error && (
                <p className="mt-4 text-red-700 dark:text-red-300" role="alert">
                    {error}
                </p>
            )}
            <button
                disabled={busy}
                className="mt-5 block text-brand"
                onClick={() => void switchAccount()}
            >
                Увійти іншим акаунтом
            </button>
            <a href="/" className="mt-6 block underline">
                До робочого простору
            </a>
        </main>
    );
}
