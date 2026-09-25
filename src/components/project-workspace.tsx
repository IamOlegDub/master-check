'use client';
import { useCallback, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ProjectEstimate } from '@/components/project-estimate';
import { PhotoGallery } from '@/components/photo-gallery';
import { ShareLink } from '@/components/share-link';
import { ActionModal } from '@/components/action-modal';
import { BusyIndicator } from '@/components/feedback';
import { OverviewVideo } from '@/components/overview-video';
import { PhotoSelection } from '@/components/photo-selection';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { uploadPhotos } from '@/lib/photos';
import { formatPrice, serviceUnits } from '@/lib/price-list';
import {
    displayDate,
    localDateTime,
    type EstimateItem,
    type ProjectPayment,
} from '@/lib/estimates';
import {
    inputClass,
    panelClass,
    statusLabels,
    message,
    type WorkspaceProject,
    type Contact,
} from '@/lib/workspace';

export type WorkReport = {
    id: string;
    item_id: string;
    quantity: number;
    amount: number;
    status: 'SUBMITTED' | 'CONFIRMED' | 'CHANGES_REQUESTED';
    note: string;
    photos: string[];
    occurred_at: string;
    submitted_at: string;
    reviewed_at: string | null;
    review_note: string | null;
};
export type WorkflowDetail = {
    project: WorkspaceProject;
    is_owner: boolean;
    has_client: boolean;
    items: EstimateItem[];
    reports: WorkReport[];
    payments: ProjectPayment[];
    confirmed_total: number;
    pending_count: number;
    activity?: { action: string; occurred_at: string; note: string }[];
};
export function ProjectWorkspace({
    initial,
    userId,
    contacts,
}: {
    initial: WorkflowDetail;
    userId: string;
    contacts: Contact[];
}) {
    const router = useRouter();
    const [showRevision, setShowRevision] = useState(false);
    const [data, setData] = useState(initial),
        [error, setError] = useState(''),
        [notice, setNotice] = useState(''),
        [busy, setBusy] = useState(false),
        [invite, setInvite] = useState(''),
        [reason, setReason] = useState(''),
        [files, setFiles] = useState<File[]>([]),
        [showReport, setShowReport] = useState(false),
        [reportTab, setReportTab] = useState('SUBMITTED'),
        [tab, setTab] = useState<'estimate' | 'work' | 'payments' | 'access'>(
            initial.project.status === 'DRAFT'
                ? 'estimate'
                : initial.project.status === 'PENDING_APPROVAL'
                  ? 'access'
                  : 'work',
        ),
        [reportItem, setReportItem] = useState(''),
        [reportQuantity, setReportQuantity] = useState('');
    const lock = useRef(false);
    const uploading = useRef(false);
    const reportId = useRef('');
    const projectId = initial.project.id;
    const reload = useCallback(async () => {
        const c = createSupabaseBrowserClient();
        if (!c) return;
        const r = await c.rpc('workflow_detail', { p_project_id: projectId });
        if (r.error) {
            setError(message(r.error));
            return;
        }
        setData(r.data as WorkflowDetail);
    }, [projectId]);
    const changed = useCallback(() => {
        void reload();
    }, [reload]);
    async function action(name: string, payload: Record<string, unknown> = {}) {
        if (lock.current) return false;
        lock.current = true;
        setBusy(true);
        setError('');
        setNotice('');
        try {
            const c = createSupabaseBrowserClient();
            if (!c) throw Error('Немає з’єднання.');
            const r = await c.rpc('workflow_action', {
                p_project_id: projectId,
                p_action: name,
                p_payload: { ...payload, version: data.project.version },
            });
            if (r.error) throw r.error;
            setData(r.data);
            setNotice('Зміни збережено.');
            setReason('');
            return true;
        } catch (e) {
            setError(message(e) + ' Оновіть дані перед повторною дією.');
            await reload();
            return false;
        } finally {
            lock.current = false;
            setBusy(false);
        }
    }
    async function makeInvite() {
        if (busy) return;
        setBusy(true);
        setError('');
        try {
            const c = createSupabaseBrowserClient();
            if (!c) throw Error('Немає з’єднання.');
            const r = await c.rpc('make_invite', { p_project_id: projectId });
            if (r.error) throw r.error;
            setInvite(`${location.origin}/invite/${r.data}`);
        } catch (e) {
            setError(message(e));
        } finally {
            setBusy(false);
        }
    }
    async function submitReport(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (lock.current || uploading.current || busy) return;
        uploading.current = true;
        const form = e.currentTarget,
            fields = new FormData(form);
        setError('');
        setBusy(true);
        let paths: string[] = [];
        try {
            const c = createSupabaseBrowserClient();
            if (!c) throw Error('Немає з’єднання.');
            // A lost response must not cause a second report on retry.
            if (reportId.current) {
                const check = await c.rpc('workflow_detail', { p_project_id: projectId });
                if (check.error) throw check.error;
                if ((check.data as WorkflowDetail).reports.some((r) => r.id === reportId.current)) {
                    setData(check.data);
                    reportId.current = '';
                    setFiles([]);
                    setShowReport(false);
                    setNotice('Звіт уже збережено.');
                    return;
                }
            }
            if (files.length > 10) throw Error('До одного звіту — максимум 10 фото.');
            reportId.current ||= crypto.randomUUID();
            const id = reportId.current;
            paths = await uploadPhotos('reports', `${projectId}/${userId}/${id}`, files);
            const success = await action('submit_report', {
                id,
                item_id: fields.get('item_id'),
                quantity: fields.get('quantity'),
                note: fields.get('note'),
                occurred_at: new Date(String(fields.get('date'))).toISOString(),
                photos: paths,
            });
            if (success) {
                reportId.current = '';
                setFiles([]);
                setShowReport(false);
                setReportTab('SUBMITTED');
                form.reset();
            } else if (paths.length) {
                // Storage policies retain files belonging to any saved report.
                await c.storage.from('reports').remove(paths);
            }
        } catch (e) {
            setError(message(e));
            if (paths.length)
                await createSupabaseBrowserClient()?.storage.from('reports').remove(paths);
        } finally {
            uploading.current = false;
            setBusy(false);
        }
    }
    const owner = data.is_owner,
        p = data.project;
    const contact = contacts.find((c) => c.id === p.client_id);
    const confirmed = Number(data.confirmed_total),
        balance = confirmed - Number(p.paid);
    const reports = data.reports.filter((r) => r.status === reportTab);
    return (
        <>
            <BusyIndicator busy={busy} label="Оновлюємо проєкт…" />
            {showRevision && (
                <ActionModal
                    title="Додати роботи до кошторису"
                    onClose={() => setShowRevision(false)}
                    busy={busy}
                    error={error}
                >
                    <p className="text-subtle">
                        Кошторис уже на погодженні або в роботі. Відкрийте нову редакцію, додайте
                        потрібні послуги та надішліть кошторис замовнику повторно. Збережені оплати
                        й підтверджені роботи залишаться.
                    </p>
                    {data.reports.some((r) => r.status === 'SUBMITTED') ? (
                        <p className="mt-4 rounded-xl bg-amber-50 dark:bg-amber-950 p-4 text-amber-900 dark:text-amber-300">
                            Спочатку замовник має перевірити надіслані звіти. Після цього можна
                            змінити кошторис.
                        </p>
                    ) : (
                        <Button
                            variant="brand"
                            className="mt-5"
                            disabled={busy}
                            onClick={async () => {
                                if (await action('revise')) {
                                    setShowRevision(false);
                                    setTab('estimate');
                                }
                            }}
                        >
                            Відкрити нову редакцію
                        </Button>
                    )}
                </ActionModal>
            )}
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <span className="rounded-lg bg-[var(--tone-bg-efedfc)] px-3 py-1 text-xs text-brand">
                        {statusLabels[p.status]}
                    </span>
                    <h1 className="mt-4 text-3xl font-semibold wrap-anywhere">{p.name}</h1>
                    <p className="mt-2 text-subtle">
                        {p.client || 'Замовника ще не вказано'} · створено{' '}
                        {displayDate(p.created_at)}
                    </p>
                    {p.approved_at && (
                        <p className="mt-2 text-xs text-subtle">
                            Кошторис затверджено {displayDate(p.approved_at)}
                        </p>
                    )}
                </div>
                <Button variant="outline" disabled={busy} onClick={() => void reload()}>
                    Оновити дані
                </Button>
            </div>
            {error && (
                <p
                    role="alert"
                    className="rounded-xl bg-red-50 dark:bg-red-950 p-4 text-red-700 dark:text-red-300"
                >
                    {error}
                </p>
            )}
            {notice && (
                <p
                    role="status"
                    className="rounded-xl bg-emerald-50 dark:bg-emerald-950 p-4 text-emerald-800 dark:text-emerald-300"
                >
                    {notice}
                </p>
            )}
            <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Баланс проєкту">
                {[
                    ['Плановий кошторис', Number(p.total)],
                    ['Підтверджено робіт', confirmed],
                    ['Отримано оплат', Number(p.paid)],
                    ['Поточний баланс', balance],
                ].map(([label, value]) => (
                    <div key={String(label)} className={panelClass}>
                        <p className="text-xs text-subtle">{label}</p>
                        <strong className="mt-3 block text-lg tabular-nums wrap-anywhere">
                            {formatPrice(Number(value))}
                        </strong>
                    </div>
                ))}
            </section>
            <p className="text-xs text-subtle">
                {balance > 0
                    ? 'Замовнику залишилося оплатити підтверджені роботи.'
                    : balance < 0
                      ? 'Є кошти замовника в рахунок майбутніх робіт.'
                      : 'Підтверджені роботи та оплати збалансовані.'}{' '}
                Залишок за всім планом: {formatPrice(Math.max(0, Number(p.total) - Number(p.paid)))}
                .
            </p>
            <nav
                aria-label="Розділи проєкту"
                className="sticky top-2 z-30 grid grid-cols-4 gap-1 rounded-2xl border border-line bg-card p-1.5 shadow-sm"
            >
                {(
                    [
                        ['estimate', 'Кошторис'],
                        ['work', 'Виконання'],
                        ['payments', 'Оплати'],
                        ['access', 'Доступ'],
                    ] as const
                ).map(([value, label]) => (
                    <button
                        key={value}
                        aria-current={tab === value ? 'page' : undefined}
                        onClick={() => setTab(value)}
                        className="min-h-12 rounded-xl px-1 text-xs font-medium text-subtle transition hover:bg-[var(--tone-bg-f5f3fc)] aria-[current=page]:bg-[var(--brand-solid)] aria-[current=page]:text-white sm:text-sm"
                    >
                        {label}
                        {value === 'work' && data.pending_count > 0
                            ? ` (${data.pending_count})`
                            : ''}
                    </button>
                ))}
            </nav>
            <section hidden={tab !== 'access'} className={panelClass}>
                <h2 className="text-lg font-semibold">Погодження та доступ</h2>
                {owner && (
                    <>
                        <p className="mt-2 text-subtle">
                            {data.has_client
                                ? 'Замовник підключений до проєкту.'
                                : 'Надішліть замовнику одноразове запрошення. Воно діє 7 днів; нове посилання скасовує попереднє.'}
                        </p>
                        {p.status === 'DRAFT' && (
                            <label className="mt-4 block">
                                Картка клієнта
                                <select
                                    disabled={busy}
                                    className={inputClass}
                                    value={p.client_id ?? ''}
                                    onChange={(e) =>
                                        void action('link_client', {
                                            client_id: e.target.value || null,
                                        })
                                    }
                                >
                                    <option value="">Без картки</option>
                                    {contacts.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name} · {c.phone}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        )}
                        {!data.has_client && (
                            <Button
                                className="mt-4"
                                variant="outline"
                                disabled={busy}
                                onClick={() => void makeInvite()}
                            >
                                Створити запрошення
                            </Button>
                        )}
                        {invite && !data.has_client && (
                            <ShareLink
                                url={invite}
                                title={`Запрошення: ${p.name}`}
                                phone={contact?.phone}
                            />
                        )}
                    </>
                )}
                <div className="mt-4 flex flex-wrap gap-3">
                    {owner && p.status === 'DRAFT' && (
                        <Button
                            variant="brand"
                            disabled={busy || !data.has_client || !data.items.length}
                            onClick={() => void action('request_approval')}
                        >
                            Надіслати кошторис на затвердження
                        </Button>
                    )}
                    {!owner && p.status === 'PENDING_APPROVAL' && (
                        <>
                            <Button
                                variant="brand"
                                disabled={busy}
                                onClick={() => void action('approve')}
                            >
                                Затвердити кошторис
                            </Button>
                            <Button
                                variant="outline"
                                disabled={busy || !reason.trim()}
                                onClick={() => void action('request_changes', { note: reason })}
                            >
                                Повернути на доопрацювання
                            </Button>
                        </>
                    )}
                    {owner && p.status !== 'DRAFT' && (
                        <Button
                            disabled={busy}
                            variant="outline"
                            onClick={() => {
                                if (
                                    confirm(
                                        'Відкрити нову редакцію? Роботи призупиняться до повторного затвердження кошторису.',
                                    )
                                )
                                    void action('revise');
                            }}
                        >
                            Нова редакція кошторису
                        </Button>
                    )}
                    {owner && p.status === 'IN_PROGRESS' && (
                        <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() => void action('finish')}
                        >
                            Завершити проєкт
                        </Button>
                    )}
                </div>
                {!owner && p.status === 'PENDING_APPROVAL' && (
                    <label className="mt-4 block">
                        Що потрібно змінити?
                        <textarea
                            className={inputClass}
                            maxLength={2000}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                        />
                    </label>
                )}
                {data.activity?.map((a, index) => (
                    <p key={index} className="mt-3 text-xs text-subtle">
                        {displayDate(a.occurred_at)} · {a.note}
                    </p>
                ))}
            </section>
            <section hidden={tab !== 'work'} className={panelClass}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-xl font-semibold">Виконані обсяги та фотозвіти</h2>
                    {owner && (
                        <Button
                            variant="brand"
                            disabled={busy || p.status !== 'IN_PROGRESS'}
                            onClick={() => {
                                setReportItem(data.items[0]?.id ?? '');
                                setReportQuantity('');
                                setShowReport(true);
                            }}
                        >
                            Новий звіт
                        </Button>
                    )}
                </div>
                <p className="mt-3 text-xs text-subtle">
                    Підтвердження стосується обсягу звіту. Робота завершується після підтвердження
                    всього плану.
                </p>
                {owner && p.status !== 'IN_PROGRESS' && (
                    <p className="mt-4 rounded-xl bg-amber-50 dark:bg-amber-950 p-4 text-sm">
                        {p.status === 'COMPLETED'
                            ? 'Проєкт завершений. Для нових робіт відкрийте нову редакцію кошторису.'
                            : 'Щоб зафіксувати виконання й додати фотозвіт, потрібне погодження кошторису замовником.'}{' '}
                        <button className="text-brand underline" onClick={() => setTab('access')}>
                            Перейти до погодження
                        </button>
                    </p>
                )}
                {owner &&
                    data.items.map((i) => {
                        const done = data.reports
                            .filter((r) => r.item_id === i.id && r.status === 'CONFIRMED')
                            .reduce((sum, r) => sum + Number(r.quantity), 0);
                        return (
                            <div key={i.id} className="mt-4 text-xs">
                                <div className="flex flex-wrap justify-between gap-2">
                                    <span>{i.name}</span>
                                    <span>
                                        {done} / {i.quantity} {serviceUnits[i.unit]}
                                    </span>
                                </div>
                                <progress
                                    className="mt-2 h-2 w-full accent-brand"
                                    max={Number(i.quantity)}
                                    value={done}
                                />
                                {p.status === 'IN_PROGRESS' && (
                                    <button
                                        disabled={busy}
                                        className="mt-2 rounded-lg border border-line px-3 py-2 text-brand"
                                        onClick={() => {
                                            setReportItem(i.id);
                                            setReportQuantity(
                                                String(
                                                    Math.max(
                                                        0,
                                                        Number(i.quantity) -
                                                            data.reports
                                                                .filter(
                                                                    (r) =>
                                                                        r.item_id === i.id &&
                                                                        r.status !==
                                                                            'CHANGES_REQUESTED',
                                                                )
                                                                .reduce(
                                                                    (sum, r) =>
                                                                        sum + Number(r.quantity),
                                                                    0,
                                                                ),
                                                    ),
                                                ),
                                            );
                                            setShowReport(true);
                                        }}
                                    >
                                        Зафіксувати виконання / фото
                                    </button>
                                )}
                            </div>
                        );
                    })}
                {showReport && (
                    <ActionModal
                        title="Виконані роботи та фотозвіт"
                        busy={busy}
                        onClose={() => setShowReport(false)}
                        error={error}
                    >
                        <form onSubmit={submitReport} className="mt-5 border-t border-line pt-5">
                            <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
                                <label>
                                    Робота
                                    <select
                                        required
                                        name="item_id"
                                        className={inputClass}
                                        value={reportItem}
                                        onChange={(e) => {
                                            setReportItem(e.target.value);
                                            setReportQuantity('');
                                        }}
                                    >
                                        {data.items.map((i) => (
                                            <option key={i.id} value={i.id}>
                                                {i.name} · план {i.quantity} {serviceUnits[i.unit]}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label>
                                    Виконаний обсяг
                                    <input
                                        required
                                        name="quantity"
                                        value={reportQuantity}
                                        onChange={(e) => setReportQuantity(e.target.value)}
                                        type="number"
                                        min="0.001"
                                        step="0.001"
                                        className={inputClass}
                                    />
                                </label>
                                <label>
                                    Дата й час виконання
                                    <input
                                        required
                                        name="date"
                                        type="datetime-local"
                                        defaultValue={localDateTime()}
                                        className={inputClass}
                                    />
                                </label>
                                <label>
                                    Фото (до 10 файлів, до 10 МБ кожне)
                                    <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        multiple
                                        className={inputClass}
                                        onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                                    />
                                </label>
                                <PhotoSelection
                                    files={files}
                                    disabled={busy}
                                    onRemove={(index) =>
                                        setFiles((current) => current.filter((_, i) => i !== index))
                                    }
                                />
                                <label className="sm:col-span-2">
                                    Коментар
                                    <textarea name="note" maxLength={2000} className={inputClass} />
                                </label>
                                <Button type="submit" variant="brand">
                                    {busy ? 'Надсилаємо…' : 'Надіслати звіт на перевірку'}
                                </Button>
                            </fieldset>
                        </form>
                    </ActionModal>
                )}
                <div className="my-5 flex flex-wrap gap-2">
                    {[
                        ['SUBMITTED', 'Очікують перевірки'],
                        ['CONFIRMED', 'Архів підтверджених'],
                        ['CHANGES_REQUESTED', 'Повернуті'],
                    ].map(([status, label]) => (
                        <button
                            key={status}
                            onClick={() => setReportTab(status)}
                            aria-pressed={reportTab === status}
                            className="rounded-xl border border-line px-3 py-2 text-xs aria-pressed:bg-[var(--brand-solid)] aria-pressed:text-white"
                        >
                            {label} ({data.reports.filter((r) => r.status === status).length})
                        </button>
                    ))}
                </div>
                {!reports.length && (
                    <p className="text-subtle">Звітів у цьому розділі поки немає.</p>
                )}
                {reports.map((r) => (
                    <article key={r.id} className="mt-4 border-t border-line pt-5">
                        <h3 className="font-semibold">
                            {data.items.find((i) => i.id === r.item_id)?.name}
                        </h3>
                        <p className="mt-2">
                            {r.quantity}{' '}
                            {serviceUnits[data.items.find((i) => i.id === r.item_id)!.unit]} ·{' '}
                            {formatPrice(Number(r.amount))}
                        </p>
                        <p className="mt-2 whitespace-pre-wrap wrap-anywhere">{r.note}</p>
                        <p className="mt-2 text-xs text-subtle">
                            Виконано {displayDate(r.occurred_at)} · надіслано{' '}
                            {displayDate(r.submitted_at)}
                            {r.reviewed_at && ` · перевірено ${displayDate(r.reviewed_at)}`}
                        </p>
                        {r.review_note && (
                            <p className="mt-2 rounded-lg bg-amber-50 dark:bg-amber-950 p-3">
                                Коментар замовника: {r.review_note}
                            </p>
                        )}
                        <PhotoGallery
                            bucket="reports"
                            photos={r.photos.map((path) => ({ path }))}
                        />
                        {!owner && r.status === 'SUBMITTED' && (
                            <form
                                className="mt-4 grid gap-3"
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    void action('return_report', {
                                        id: r.id,
                                        note: String(new FormData(e.currentTarget).get('reason')),
                                    });
                                }}
                            >
                                <label>
                                    Коментар для повернення
                                    <textarea
                                        name="reason"
                                        required
                                        maxLength={2000}
                                        className={inputClass}
                                    />
                                </label>
                                <div className="flex flex-wrap gap-3">
                                    <Button
                                        type="button"
                                        disabled={busy}
                                        variant="brand"
                                        onClick={() => void action('confirm_report', { id: r.id })}
                                    >
                                        Підтвердити {r.quantity}
                                    </Button>
                                    <Button type="submit" disabled={busy} variant="outline">
                                        Повернути на доопрацювання
                                    </Button>
                                </div>
                            </form>
                        )}
                    </article>
                ))}
            </section>
            {owner && (tab === 'estimate' || tab === 'payments') ? (
                <ProjectEstimate
                    key={p.status}
                    projectId={projectId}
                    userId={userId}
                    onProjectChange={changed}
                    openPriceList={() => router.push('/services')}
                    workflowMode
                    estimateLocked={p.status !== 'DRAFT'}
                    onRevise={p.status === 'COMPLETED' ? undefined : () => setShowRevision(true)}
                    view={tab}
                />
            ) : !owner ? (
                <>
                    <section hidden={tab !== 'estimate'} className={panelClass}>
                        <h2 className="text-xl font-semibold">Кошторис</h2>
                        {data.items.map((i) => {
                            const done = data.reports
                                .filter((r) => r.item_id === i.id && r.status === 'CONFIRMED')
                                .reduce((s, r) => s + Number(r.quantity), 0);
                            return (
                                <div key={i.id} className="mt-4 border-t border-line pt-4">
                                    <h3 className="font-semibold">{i.name}</h3>
                                    <p className="mt-2">
                                        {i.quantity} {serviceUnits[i.unit]} ×{' '}
                                        {formatPrice(Number(i.unit_price))} · коригування{' '}
                                        {i.adjustment_percent}%
                                    </p>
                                    <p className="mt-2 font-semibold">
                                        {formatPrice(Number(i.line_total))}
                                    </p>
                                    <p className="mt-2 text-xs text-subtle">
                                        Підтверджено {done} із {i.quantity} {serviceUnits[i.unit]}
                                    </p>
                                    <progress
                                        className="mt-2 h-2 w-full accent-brand"
                                        value={done}
                                        max={Number(i.quantity)}
                                    />
                                </div>
                            );
                        })}
                    </section>
                    <section hidden={tab !== 'payments'} className={panelClass}>
                        <h2 className="text-xl font-semibold">Оплати та аванси</h2>
                        {data.payments.map((r) => (
                            <div key={r.id} className="mt-4 border-t border-line pt-4">
                                <strong className={r.voided_at ? 'line-through text-subtle' : ''}>
                                    {formatPrice(Number(r.amount))}
                                </strong>
                                <p className="text-xs text-subtle">
                                    {r.kind === 'advance' ? 'Аванс' : 'Оплата роботи'} ·{' '}
                                    {displayDate(r.occurred_at)} · записано{' '}
                                    {displayDate(r.recorded_at)}
                                </p>
                                <p>{r.note}</p>
                                {r.voided_at && (
                                    <p className="text-xs">
                                        Скасовано {displayDate(r.voided_at)} · {r.void_reason}
                                    </p>
                                )}
                            </div>
                        ))}
                        {!data.payments.length && (
                            <p className="mt-4 text-subtle">Оплат ще немає.</p>
                        )}
                    </section>
                </>
            ) : null}
            {tab === 'work' && (
                <OverviewVideo
                    path={p.overview_video_path}
                    addedAt={p.overview_video_at}
                    owner={owner}
                    userId={userId}
                    projectId={projectId}
                    onChanged={changed}
                />
            )}
        </>
    );
}
