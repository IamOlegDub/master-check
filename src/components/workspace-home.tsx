'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { formatPrice } from '@/lib/price-list';
import {
    statusLabels,
    inputClass,
    panelClass,
    message,
    type Role,
    type WorkspaceProject,
    type Contact,
} from '@/lib/workspace';

export function WorkspaceHome({
    projects,
    contacts,
    userId,
    role,
    overview = false,
}: {
    projects: WorkspaceProject[];
    contacts: Contact[];
    userId: string;
    role: Role;
    overview?: boolean;
}) {
    const router = useRouter();
    const [query, setQuery] = useState(''),
        [status, setStatus] = useState(''),
        [form, setForm] = useState(false),
        [busy, setBusy] = useState(false),
        [error, setError] = useState('');
    async function create(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setError('');
        const fields = new FormData(e.currentTarget);
        try {
            const client = createSupabaseBrowserClient();
            if (!client) throw Error('Немає з’єднання.');
            const contact = contacts.find((c) => c.id === fields.get('client_id'));
            const result = await client
                .from('projects')
                .insert({
                    user_id: userId,
                    name: String(fields.get('name')).trim(),
                    client: contact?.name ?? '',
                    client_id: contact?.id ?? null,
                    status: 'DRAFT',
                })
                .select('id')
                .single();
            if (result.error) throw result.error;
            router.push(`/projects/${result.data.id}`);
        } catch (e) {
            setError(message(e));
        } finally {
            setBusy(false);
        }
    }
    const confirmed = projects.reduce((s, p) => s + Number(p.confirmed_total), 0),
        paid = projects.reduce((s, p) => s + Number(p.paid), 0),
        advances = projects.reduce((s, p) => s + Number(p.advance_total), 0);
    return (
        <>
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <p className="text-xs text-subtle">
                        {role === 'MASTER' ? 'КАБІНЕТ МАЙСТРА' : 'КАБІНЕТ ЗАМОВНИКА'}
                    </p>
                    <h1 className="mt-2 text-3xl font-semibold">
                        {overview ? 'Робочий простір' : 'Проєкти'}
                    </h1>
                </div>
                {role === 'MASTER' && (
                    <Button variant="brand" onClick={() => setForm(!form)}>
                        Створити проєкт
                    </Button>
                )}
            </div>
            {overview && (
                <>
                    <section
                        className="grid gap-3 sm:grid-cols-3"
                        aria-label="Фінансова статистика"
                    >
                        {[
                            ['Підтверджено робіт', confirmed],
                            ['Отримано авансів', advances],
                            ['Поточний баланс', confirmed - paid],
                        ].map(([label, value]) => (
                            <div key={String(label)} className={panelClass}>
                                <p className="text-xs text-subtle">{label}</p>
                                <strong className="mt-4 block text-2xl tabular-nums wrap-anywhere">
                                    {formatPrice(Number(value))}
                                </strong>
                            </div>
                        ))}
                    </section>
                    <p className="text-xs text-subtle">
                        Баланс: підтверджені роботи мінус усі оплати. Додатний — до сплати майстру;
                        від’ємний — кошти замовника в рахунок майбутніх робіт.
                    </p>
                    {role === 'MASTER' && (
                        <div className="flex flex-wrap gap-3">
                            <Link
                                href="/portfolio"
                                className="rounded-xl border border-line bg-white p-3"
                            >
                                Додати фото в портфоліо
                            </Link>
                            <Link
                                href="/services"
                                className="rounded-xl border border-line bg-white p-3"
                            >
                                Поділитися прайсом / PDF
                            </Link>
                        </div>
                    )}
                </>
            )}
            {error && (
                <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">
                    {error}
                </p>
            )}
            {form && role === 'MASTER' && (
                <form onSubmit={create} className={panelClass}>
                    <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
                        <label>
                            Назва об’єкта
                            <input
                                className={inputClass}
                                name="name"
                                required
                                maxLength={160}
                                placeholder="вул. Мазепи, 21"
                            />
                        </label>
                        <label>
                            Клієнт
                            <select name="client_id" className={inputClass}>
                                <option value="">Додам пізніше / запрошу за посиланням</option>
                                {contacts.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name} · {c.phone}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <Button type="submit" variant="brand" disabled={busy}>
                            {busy ? 'Створюємо…' : 'Створити чернетку'}
                        </Button>
                    </fieldset>
                </form>
            )}
            <div className="flex flex-wrap gap-3">
                <input
                    aria-label="Пошук проєктів"
                    className={`${inputClass} flex-1 basis-52`}
                    placeholder="Назва об’єкта або клієнт"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                <select
                    aria-label="Статус проєктів"
                    className={`${inputClass} sm:w-auto`}
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                >
                    <option value="">Усі статуси</option>
                    {Object.entries(statusLabels).map(([k, v]) => (
                        <option key={k} value={k}>
                            {v}
                        </option>
                    ))}
                </select>
            </div>
            <section className="grid gap-4 md:grid-cols-2" aria-label="Список проєктів">
                {projects
                    .filter(
                        (p) =>
                            (!status || p.status === status) &&
                            `${p.name} ${p.client}`
                                .toLocaleLowerCase('uk')
                                .includes(query.toLocaleLowerCase('uk')),
                    )
                    .map((p) => (
                        <Link
                            key={p.id}
                            href={`/projects/${p.id}`}
                            className={`${panelClass} block transition hover:border-brand`}
                        >
                            <span className="rounded-lg bg-[#efedfc] px-2 py-1 text-xs text-brand">
                                {statusLabels[p.status]}
                            </span>
                            <h2 className="my-3 text-xl font-semibold wrap-anywhere">{p.name}</h2>
                            <p className="text-subtle">{p.client || 'Замовника ще не вказано'}</p>
                            <p className="mt-4">Кошторис: {formatPrice(Number(p.total))}</p>
                            <p>Баланс: {formatPrice(Number(p.confirmed_total) - Number(p.paid))}</p>
                            <div className="mt-4 flex justify-between text-xs">
                                <span>Підтверджений прогрес</span>
                                <span>{p.progress}%</span>
                            </div>
                            <progress
                                className="mt-2 h-2 w-full accent-brand"
                                max={100}
                                value={Number(p.progress)}
                            />
                            {(p.pending_count > 0 || p.status === 'PENDING_APPROVAL') && (
                                <p className="mt-3 text-brand">
                                    Очікує підтвердження:{' '}
                                    {Number(p.pending_count) +
                                        (p.status === 'PENDING_APPROVAL' ? 1 : 0)}
                                </p>
                            )}
                        </Link>
                    ))}
            </section>
            {!projects.length && (
                <div className={panelClass}>
                    {role === 'MASTER'
                        ? 'Створіть перший проєкт і додайте роботи зі свого прайсу.'
                        : 'Тут з’являться проєкти після прийняття запрошення від майстра.'}
                </div>
            )}
        </>
    );
}
