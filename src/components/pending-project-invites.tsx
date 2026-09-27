'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { panelClass } from '@/lib/workspace';

export function PendingProjectInvites() {
    const [invites, setInvites] = useState<{ token: string; name: string }[]>([]);
    const [error, setError] = useState(false);
    const load = useCallback(async () => {
        const c = createSupabaseBrowserClient();
        if (!c) return;
        try {
            const r = await c.rpc('pending_project_invites');
            if (r.error) throw r.error;
            setInvites(r.data ?? []);
            setError(false);
        } catch {
            setError(true);
        }
    }, []);
    useEffect(() => {
        const update = () => {
            if (document.visibilityState === 'visible') void load();
        };
        void load();
        window.addEventListener('focus', update);
        const timer = window.setInterval(update, 15000);
        return () => {
            window.removeEventListener('focus', update);
            clearInterval(timer);
        };
    }, [load]);
    if (error)
        return (
            <p role="alert">
                Не вдалося перевірити запрошення.{' '}
                <button className="underline" onClick={() => void load()}>
                    Повторити
                </button>
            </p>
        );
    if (!invites.length) return null;
    return (
        <section className={panelClass}>
            <h2 className="font-semibold">Запрошення до проєктів</h2>
            {invites.map((i) => (
                <div
                    key={i.token}
                    className="mt-3 flex flex-wrap items-center justify-between gap-3"
                >
                    <span>{i.name}</span>
                    <Link
                        className="rounded-lg bg-brand/10 p-3 text-brand"
                        href={`/invite/${i.token}`}
                    >
                        Переглянути й прийняти
                    </Link>
                </div>
            ))}
        </section>
    );
}
