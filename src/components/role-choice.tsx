'use client';
import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { message } from '@/lib/workspace';
export function RoleChoice() {
    const [busy, setBusy] = useState(false),
        [error, setError] = useState('');
    async function choose(role: string) {
        setBusy(true);
        try {
            const c = createSupabaseBrowserClient();
            if (!c) throw Error('Немає з’єднання.');
            const r = await c.rpc('choose_role', { p_role: role });
            if (r.error) throw r.error;
            window.location.assign('/');
        } catch (e) {
            setError(message(e));
            setBusy(false);
        }
    }
    return (
        <main className="mx-auto max-w-xl p-6 py-16">
            <h1 className="text-3xl font-semibold">Як ви користуватиметеся застосунком?</h1>
            <p className="my-5 text-subtle">
                Якщо майстер надіслав запрошення, відкрийте його або оберіть роль замовника.
            </p>
            <div className="grid gap-4">
                {[
                    ['MASTER', 'Я майстер', 'Створюю кошториси, веду роботи та оплату.'],
                    ['CLIENT', 'Я замовник', 'Переглядаю запрошені проєкти та підтверджую роботи.'],
                ].map(([role, label, hint]) => (
                    <button
                        key={role}
                        disabled={busy}
                        onClick={() => void choose(role)}
                        className="rounded-2xl border border-line bg-white p-6 text-left hover:border-brand disabled:opacity-50"
                    >
                        <strong className="text-lg">{label}</strong>
                        <span className="mt-2 block text-subtle">{hint}</span>
                    </button>
                ))}
            </div>
            {error && (
                <p role="alert" className="mt-4 text-red-700">
                    {error}
                </p>
            )}
        </main>
    );
}
