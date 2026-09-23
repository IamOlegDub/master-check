'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ShareLink } from '@/components/share-link';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { inputClass, panelClass, message, type Contact } from '@/lib/workspace';
export function ClientsManager({
    initial,
    projects,
    userId,
    portfolioToken,
}: {
    initial: Contact[];
    projects: { id: string; name: string; client_id: string | null }[];
    userId: string;
    portfolioToken?: string;
}) {
    const [clients, setClients] = useState(initial),
        [editing, setEditing] = useState<Contact | null>(null),
        [error, setError] = useState(''),
        [busy, setBusy] = useState(false),
        [query, setQuery] = useState(''),
        [share, setShare] = useState<{ clientId: string; url: string; title: string } | null>(null);
    async function save(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (busy) return;
        const form = e.currentTarget,
            fields = new FormData(form),
            name = String(fields.get('name')).trim(),
            phone = String(fields.get('phone')).trim(),
            notes = String(fields.get('notes')).trim();
        if (!name) {
            setError('Вкажіть ім’я.');
            return;
        }
        setBusy(true);
        setError('');
        try {
            const c = createSupabaseBrowserClient();
            if (!c) throw Error('Немає з’єднання.');
            const data = { name, phone, notes, updated_at: new Date().toISOString() };
            const r = editing
                ? await c
                      .from('clients')
                      .update(data)
                      .eq('id', editing.id)
                      .eq('user_id', userId)
                      .select('*')
                      .single()
                : await c
                      .from('clients')
                      .insert({ ...data, user_id: userId })
                      .select('*')
                      .single();
            if (r.error) throw r.error;
            setClients((old) =>
                editing ? old.map((x) => (x.id === editing.id ? r.data : x)) : [r.data, ...old],
            );
            setEditing(null);
            form.reset();
        } catch (e) {
            setError(message(e));
        } finally {
            setBusy(false);
        }
    }
    async function remove(client: Contact) {
        if (!confirm(`Видалити контакт «${client.name}»?`)) return;
        setBusy(true);
        setError('');
        try {
            const c = createSupabaseBrowserClient();
            if (!c) throw Error('Немає з’єднання.');
            const r = await c.from('clients').delete().eq('id', client.id).select('id');
            if (r.error)
                throw Error('Контакт не вдалося видалити. Спершу від’єднайте його від проєктів.');
            if (!r.data?.length) throw Error('Контакт уже змінено. Оновіть сторінку.');
            setClients((x) => x.filter((a) => a.id !== client.id));
        } catch (e) {
            setError(message(e));
        } finally {
            setBusy(false);
        }
    }
    return (
        <>
            <h1 className="text-3xl font-semibold">Клієнти</h1>
            {error && (
                <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">
                    {error}
                </p>
            )}
            <form key={editing?.id ?? 'new'} onSubmit={save} className={panelClass}>
                <h2 className="text-lg font-semibold">
                    {editing ? 'Редагувати контакт' : 'Новий контакт'}
                </h2>
                <fieldset disabled={busy} className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label>
                        Ім’я
                        <input
                            name="name"
                            required
                            maxLength={160}
                            defaultValue={editing?.name}
                            className={inputClass}
                        />
                    </label>
                    <label>
                        Телефон
                        <input
                            type="tel"
                            name="phone"
                            maxLength={30}
                            defaultValue={editing?.phone}
                            className={inputClass}
                        />
                    </label>
                    <label className="sm:col-span-2">
                        Нотатки
                        <textarea
                            name="notes"
                            maxLength={2000}
                            defaultValue={editing?.notes}
                            className={inputClass}
                        />
                    </label>
                    <div className="flex gap-2">
                        <Button type="submit" variant="brand">
                            Зберегти
                        </Button>
                        {editing && (
                            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                                Скасувати
                            </Button>
                        )}
                    </div>
                </fieldset>
            </form>
            <input
                className={inputClass}
                aria-label="Пошук клієнтів"
                placeholder="Ім’я або телефон"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
            />
            <section className="grid gap-4 md:grid-cols-2">
                {clients
                    .filter((c) =>
                        `${c.name} ${c.phone}`.toLowerCase().includes(query.toLowerCase()),
                    )
                    .map((c) => (
                        <article key={c.id} className={panelClass}>
                            <h2 className="text-lg font-semibold">{c.name}</h2>
                            <a
                                className="mt-2 block text-brand"
                                href={`tel:${c.phone.replace(/[^+\d]/g, '')}`}
                            >
                                {c.phone}
                            </a>
                            <p className="my-3 whitespace-pre-wrap wrap-anywhere text-subtle">
                                {c.notes}
                            </p>
                            <div className="grid gap-2">
                                {projects
                                    .filter((p) => p.client_id === c.id)
                                    .map((p) => (
                                        <Link
                                            key={p.id}
                                            href={`/projects/${p.id}`}
                                            className="text-brand underline"
                                        >
                                            {p.name} · кошторис і запрошення
                                        </Link>
                                    ))}
                            </div>
                            <div className="mt-4 flex flex-wrap gap-3 text-xs text-brand">
                                {portfolioToken && (
                                    <button
                                        onClick={() =>
                                            setShare({
                                                clientId: c.id,
                                                url: `${location.origin}/share/${portfolioToken}`,
                                                title: 'Моє портфоліо',
                                            })
                                        }
                                    >
                                        Надіслати портфоліо
                                    </button>
                                )}
                                {projects
                                    .filter((p) => p.client_id === c.id)
                                    .map((p) => (
                                        <button
                                            key={p.id}
                                            onClick={() =>
                                                setShare({
                                                    clientId: c.id,
                                                    url: `${location.origin}/projects/${p.id}`,
                                                    title: `Кошторис: ${p.name}`,
                                                })
                                            }
                                        >
                                            Надіслати кошторис «{p.name}»
                                        </button>
                                    ))}
                            </div>
                            {share?.clientId === c.id && (
                                <>
                                    <ShareLink
                                        url={share.url}
                                        title={share.title}
                                        phone={c.phone}
                                    />
                                    <p className="mt-2 text-xs text-subtle">
                                        Кошторис доступний після прийняття запрошення в проєкт.
                                        Публічне портфоліо вмикається в розділі «Портфоліо».
                                    </p>
                                </>
                            )}
                            <div className="mt-4 flex gap-2">
                                <Button
                                    disabled={busy}
                                    variant="outline"
                                    onClick={() => {
                                        setEditing(c);
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                >
                                    Редагувати
                                </Button>
                                <Button
                                    disabled={busy}
                                    variant="ghost"
                                    onClick={() => void remove(c)}
                                >
                                    Видалити
                                </Button>
                            </div>
                        </article>
                    ))}
            </section>
            {!clients.length && (
                <p className="text-subtle">
                    Контакти можна створити до реєстрації замовника. Доступ до проєкту надається
                    через запрошення.
                </p>
            )}
        </>
    );
}
