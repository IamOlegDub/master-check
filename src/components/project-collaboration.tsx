'use client';

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
    type ReactNode,
    type FormEvent,
} from 'react';
import { MessageSquare, Paperclip, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { displayDate, eventLabels, type ProjectEvent } from '@/lib/estimates';
import { formatPrice } from '@/lib/price-list';
import { inputClass, message, panelClass } from '@/lib/workspace';

type Attachment = { path: string; name: string };
type Comment = {
    id: string;
    item_id: string | null;
    item_name?: string | null;
    author_id: string;
    body: string;
    attachments: Attachment[];
    created_at: string;
};
type Notice = {
    id: string;
    author_id: string;
    amount: number;
    note: string;
    attachments: Attachment[];
    created_at: string;
    confirmed_at: string | null;
};
type Detail = {
    project_version?: number;
    has_client?: boolean;
    comments: Comment[];
    notices: Notice[];
    events: ProjectEvent[];
};
type Context = {
    detail: Detail;
    ownerId: string;
    itemIds: string[];
    userId: string;
    projectId: string;
    refresh: () => Promise<void>;
    act: (action: string, payload: Record<string, unknown>) => Promise<void>;
};
const CollaborationContext = createContext<Context | null>(null);

export function ProjectCollaborationProvider({
    projectId,
    userId,
    ownerId,
    itemIds,
    onChanged,
    children,
}: {
    projectId: string;
    userId: string;
    ownerId: string;
    onChanged: () => void;
    children: ReactNode;
}) {
    const [detail, setDetail] = useState<Detail>({ comments: [], notices: [], events: [] });
    const [error, setError] = useState('');
    const signature = useRef('');
    const refresh = useCallback(async () => {
        try {
            const c = createSupabaseBrowserClient();
            if (!c) throw Error('Немає з’єднання.');
            const r = await c.rpc('collaboration_detail', { p_project_id: projectId });
            if (r.error) throw r.error;
            const next = r.data as Detail;
            const nextSignature = JSON.stringify([
                next.events,
                next.project_version,
                next.has_client,
            ]);
            if (signature.current && signature.current !== nextSignature) onChanged();
            signature.current = nextSignature;
            setDetail(next);
            setError('');
        } catch (e) {
            setError(message(e));
        }
    }, [projectId, onChanged]);
    useEffect(() => {
        const update = () => {
            if (document.visibilityState === 'visible') void refresh();
        };
        void refresh();
        const client = createSupabaseBrowserClient();
        const channel = client
            ?.channel('collaboration:' + projectId)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'projects', filter: 'id=eq.' + projectId },
                update,
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'project_comments',
                    filter: 'project_id=eq.' + projectId,
                },
                update,
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'payment_notices',
                    filter: 'project_id=eq.' + projectId,
                },
                update,
            )
            .subscribe();
        const timer = window.setInterval(update, 10000);
        window.addEventListener('focus', update);
        document.addEventListener('visibilitychange', update);
        return () => {
            if (channel) void client?.removeChannel(channel);
            clearInterval(timer);
            window.removeEventListener('focus', update);
            document.removeEventListener('visibilitychange', update);
        };
    }, [refresh, projectId]);
    async function act(action: string, payload: Record<string, unknown>) {
        const c = createSupabaseBrowserClient();
        if (!c) throw Error('Немає з’єднання.');
        const r = await c.rpc('collaboration_action', {
            p_project_id: projectId,
            p_action: action,
            p_payload: payload,
        });
        if (r.error) throw r.error;
        setDetail(r.data as Detail);
        onChanged();
    }
    return (
        <CollaborationContext.Provider value={{ detail, userId, ownerId, itemIds, projectId, refresh, act }}>
            {error && (
                <p role="alert" className="rounded-xl border border-line p-3">
                    Не вдалося оновити обговорення: {error}{' '}
                    <button className="underline" onClick={() => void refresh()}>
                        Повторити
                    </button>
                </p>
            )}
            {children}
        </CollaborationContext.Provider>
    );
}

function Attachments({ files }: { files: Attachment[] }) {
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    async function open(file: Attachment) {
        setError('');
        setBusy(true);
        // Open synchronously so browsers do not block the new tab after the request.
        const tab = window.open('about:blank', '_blank');
        if (tab) tab.opener = null;
        try {
            const c = createSupabaseBrowserClient();
            if (!c) throw Error('Немає з’єднання.');
            const r = await c.storage
                .from('project-attachments')
                .createSignedUrl(file.path, 60, { download: file.name });
            if (r.error) throw r.error;
            if (tab) tab.location.href = r.data.signedUrl;
            else window.location.assign(r.data.signedUrl);
        } catch (e) {
            tab?.close();
            setError(message(e));
        } finally {
            setBusy(false);
        }
    }
    return (
        <div className="mt-2 flex flex-wrap gap-2">
            {files.map((file) => (
                <button
                    key={file.path}
                    disabled={busy}
                    onClick={() => void open(file)}
                    className="inline-flex max-w-full items-center gap-1 break-all text-sm text-brand underline"
                >
                    <Paperclip size={14} className="shrink-0" />
                    {file.name}
                </button>
            ))}
            {error && <p role="alert">{error}</p>}
        </div>
    );
}

function Composer({
    itemId = null,
    payment = false,
}: {
    itemId?: string | null;
    payment?: boolean;
}) {
    const ctx = useContext(CollaborationContext)!;
    const [body, setBody] = useState('');
    const [amount, setAmount] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [retry, setRetry] = useState(false);
    const [success, setSuccess] = useState('');
    const fileInput = useRef<HTMLInputElement>(null);
    const pending = useRef<Record<string, unknown> | null>(null);
    const lock = useRef(false);
    async function submit(e: FormEvent) {
        e.preventDefault();
        if (lock.current) return;
        lock.current = true;
        setBusy(true);
        setError('');
        setSuccess('');
        try {
            if (!pending.current) {
                if (!payment && !body.trim() && !files.length)
                    throw Error('Напишіть коментар або додайте файл.');
                if (
                    payment &&
                    (!/^\d+(\.\d{1,2})?$/.test(amount) ||
                        Number(amount) <= 0 ||
                        Number(amount) > 9999999999.99)
                )
                    throw Error('Вкажіть додатну суму з точністю до копійок.');
                if (
                    files.length > 10 ||
                    files.some((f) => f.size > 100 * 1024 * 1024 || f.size === 0)
                )
                    throw Error('До 10 непорожніх файлів, кожен до 100 МБ.');
                const c = createSupabaseBrowserClient();
                if (!c) throw Error('Немає з’єднання.');
                const id = crypto.randomUUID();
                const attachments: Attachment[] = [];
                for (const file of files) {
                    const path = `${ctx.projectId}/${ctx.userId}/${id}/${crypto.randomUUID()}`;
                    const r = await c.storage
                        .from('project-attachments')
                        .upload(path, file, { contentType: file.type, upsert: false });
                    if (r.error) throw r.error;
                    attachments.push({ path, name: file.name });
                }
                pending.current = payment
                    ? { id, amount, note: body, attachments }
                    : { id, item_id: itemId, body, attachments };
            }
            await ctx.act(payment ? 'payment_notice' : 'comment', pending.current);
            pending.current = null;
            setRetry(false);
            setBody('');
            setFiles([]);
            setAmount('');
            if (fileInput.current) fileInput.current.value = '';
            setSuccess(
                payment
                    ? 'Майстер отримав повідомлення. Баланс зміниться після зарахування.'
                    : 'Коментар збережено.',
            );
        } catch (e) {
            setError(message(e));
            setRetry(!!pending.current);
        } finally {
            lock.current = false;
            setBusy(false);
        }
    }
    return (
        <form onSubmit={submit} className="mt-4 space-y-3">
            <fieldset disabled={busy || retry} className="space-y-3">
                {payment && (
                    <label className="block">
                        Сума переказу, грн
                        <input
                            className={inputClass}
                            type="number"
                            inputMode="decimal"
                            min="0.01"
                            max="9999999999.99"
                            step="0.01"
                            required
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                        />
                    </label>
                )}
                <label className="block text-sm">
                    {payment ? 'Коментар (необов’язково)' : 'Додати коментар / відповідь'}
                    <textarea
                        className={inputClass}
                        maxLength={payment ? 2000 : 4000}
                        rows={3}
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                    />
                </label>
                <label className="block text-sm">
                    <span className="flex items-center gap-2">
                        <Paperclip size={16} />
                        Фото, відео або документи
                    </span>
                    <input
                        ref={fileInput}
                        className="mt-2 block w-full text-sm"
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,image/webp,image/heic,video/mp4,video/webm,video/quicktime,application/pdf,text/plain,application/zip,.docx,.xlsx"
                        onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                    />
                </label>
                <p className="text-xs text-subtle">
                    До 10 файлів по 100 МБ. Записи та вкладення зберігаються без редагування й
                    видалення. Виправлення — новим коментарем.
                </p>
            </fieldset>
            {error && (
                <p role="alert" className="text-sm text-red-600">
                    {error}
                </p>
            )}
            {success && (
                <p role="status" className="text-sm text-brand">
                    {success}
                </p>
            )}
            <Button type="submit" variant="brand" disabled={busy}>
                {busy
                    ? 'Зберігаємо…'
                    : retry
                      ? 'Повторити збереження'
                      : payment
                        ? 'Повідомити про переказ'
                        : 'Додати коментар'}
            </Button>
        </form>
    );
}

export function ProjectComments({ itemId = null }: { itemId?: string | null }) {
    const ctx = useContext(CollaborationContext);
    if (!ctx) return null;
    const comments = ctx.detail.comments.filter((c) => c.item_id === itemId || (itemId === null && c.item_id !== null && !ctx.itemIds.includes(c.item_id)));
    return (
        <details
            className="mt-4 rounded-xl border border-line p-4"
            open={itemId === null ? true : undefined}
        >
            <summary className="cursor-pointer text-sm font-semibold">
                <MessageSquare size={16} className="mr-2 inline" />
                {itemId ? 'Коментарі до роботи' : 'Коментарі до проєкту'} ({comments.length})
            </summary>
            <ol className="mt-3 space-y-3">
                {comments.map((c) => (
                    <li key={c.id} className="border-t border-line pt-3">
                        <p className="text-xs text-subtle">
                            {c.author_id === ctx.ownerId ? 'Майстер' : 'Замовник'} ·{' '}
                            {displayDate(c.created_at)}
                        </p>
                        {c.item_id && !ctx.itemIds.includes(c.item_id) && <p className="mt-2 text-xs text-subtle">До видаленої роботи: {c.item_name ?? 'Робота'}</p>}
                        <p className="mt-2 whitespace-pre-wrap break-words">{c.body}</p>
                        <Attachments files={c.attachments} />
                    </li>
                ))}
            </ol>
            <Composer itemId={itemId} />
        </details>
    );
}

export function PaymentNotices() {
    const ctx = useContext(CollaborationContext);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    if (!ctx) return null;
    const { act, userId, ownerId, detail } = ctx;
    async function confirm(id: string) {
        if (busy) return;
        setBusy(true);
        setError('');
        try {
            await act('confirm_payment_notice', { id });
        } catch (e) {
            setError(message(e));
        } finally {
            setBusy(false);
        }
    }
    return (
        <section className={panelClass}>
            <h2 className="text-lg font-semibold">Повідомлення про перекази</h2>
            {userId !== ownerId && <Composer payment />}
            {error && <p role="alert">{error}</p>}
            {detail.notices.map((n) => (
                <article key={n.id} className="mt-4 border-t border-line pt-4">
                    <strong>Замовник повідомив про переказ {formatPrice(Number(n.amount))}</strong>
                    <p className="mt-1 text-xs text-subtle">{displayDate(n.created_at)}</p>
                    <p className="mt-2 whitespace-pre-wrap break-words">{n.note}</p>
                    <Attachments files={n.attachments} />
                    <p className="mt-2 text-sm">
                        {n.confirmed_at
                            ? `Майстер підтвердив отримання ${displayDate(n.confirmed_at)}. Оплату зараховано; подальші скасування — в історії оплат.`
                            : 'Очікує підтвердження майстра. Ще не враховано в балансі.'}
                    </p>
                    {!n.confirmed_at && userId === ownerId && (
                        <Button
                            className="mt-3"
                            variant="brand"
                            disabled={busy}
                            onClick={() => void confirm(n.id)}
                        >
                            Підтвердити й зарахувати
                        </Button>
                    )}
                </article>
            ))}
            {!detail.notices.length && (
                <p className="mt-4 text-sm text-subtle">
                    Непідтверджених переказів немає. Оплати, які вніс майстер, одразу враховані в
                    балансі.
                </p>
            )}
        </section>
    );
}

export function ProjectEventFeed() {
    const ctx = useContext(CollaborationContext);
    if (!ctx) return null;
    return (
        <section className={panelClass}>
            <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">Події проєкту</h2>
                <Button
                    variant="ghost"
                    onClick={() => void ctx.refresh()}
                    aria-label="Оновити події"
                >
                    <RefreshCw size={16} />
                </Button>
            </div>
            <ol className="mt-3 space-y-3">
                {ctx.detail.events.map((e) => (
                    <li key={e.id} className="border-t border-line pt-3">
                        <strong>
                            {e.action === 'payment'
                                ? 'Майстер зафіксував отримання оплати'
                                : (eventLabels[e.action] ?? e.action)}
                        </strong>
                        {e.details.amount !== undefined && (
                            <span> · {formatPrice(Number(e.details.amount))}</span>
                        )}
                        {!!e.details.name && <p>{String(e.details.name)}</p>}
                        {!!e.details.note && (
                            <p className="whitespace-pre-wrap break-words">
                                {String(e.details.note)}
                            </p>
                        )}
                        <p className="text-xs text-subtle">{displayDate(e.recorded_at)}</p>
                    </li>
                ))}
            </ol>
            {!ctx.detail.events.length && <p className="mt-3 text-subtle">Подій ще немає.</p>}
        </section>
    );
}

export function PaymentActivitySummary({ onOpen }: { onOpen: () => void }) {
    const ctx = useContext(CollaborationContext);
    if (!ctx) return null;
    const pending = ctx.detail.notices.filter((n) => !n.confirmed_at).length;
    if (ctx.ownerId === ctx.userId)
        return pending ? (
            <div role="status" className="rounded-xl border border-brand/30 bg-brand/5 p-4">
                <p>Повідомлень про переказ, що очікують зарахування: {pending}.</p>
                <Button className="mt-2" variant="outline" onClick={onOpen}>
                    Переглянути перекази
                </Button>
            </div>
        ) : null;
    const latest = ctx.detail.events.find((e) =>
        ['payment', 'confirm_payment_notice', 'void_payment'].includes(e.action),
    );
    if (!latest) return null;
    return (
        <div role="status" className="rounded-xl border border-brand/30 bg-brand/5 p-4">
            <p>
                {latest.action === 'void_payment'
                    ? 'Майстер скасував помилковий запис оплати. Перегляньте причину та оновлений баланс.'
                    : 'Майстер зафіксував отримання ' +
                      formatPrice(Number(latest.details.amount)) +
                      (latest.details.name
                          ? ' за роботу «' + String(latest.details.name) + '».'
                          : '. Суму враховано в балансі.')}{' '}
                Підтверджувати отримання не потрібно.
            </p>
            <p className="mt-1 text-xs text-subtle">{displayDate(latest.recorded_at)}</p>
            <Button className="mt-2" variant="outline" onClick={onOpen}>
                Переглянути оплати
            </Button>
        </div>
    );
}
