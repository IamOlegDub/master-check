'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, Clock3, Pencil, Plus, RefreshCw, Trash2, Wallet, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { formatPrice, serviceUnits, type Service } from '@/lib/price-list';
import { projectStatuses, type Project } from '@/lib/projects';
import { calculateLineTotal, displayDate, estimateError, eventLabels, localDateTime, projectBalance, type EstimateItem, type ProjectDetail, type ProjectEvent, type ProjectPayment } from '@/lib/estimates';

type Action = { kind: string; item?: EstimateItem; payment?: ProjectPayment };
type Request = { action: string; payload: Record<string, unknown>; id: string };

function historyText(event: ProjectEvent) {
    const d = event.details;
    const before = d.before as EstimateItem | string | undefined;
    const after = d.after as EstimateItem | string | undefined;
    if (event.action === 'status') return `${before} → ${after}`;
    if (event.action === 'complete_item') return `${d.name}: ${d.completed ? 'виконано' : 'повернено в роботу'}`;
    if (event.action === 'void_payment') return `${formatPrice(Number((d.payment as ProjectPayment).amount))} · ${d.reason}`;
    if (event.action === 'import') return `Кошторис ${formatPrice(Number(d.total))}; отримано ${formatPrice(Number(d.paid))}. Історичні дати невідомі.`;
    if (after && typeof after !== 'string') {
        const description = `${after.name}: ${after.quantity} ${serviceUnits[after.unit]} × ${formatPrice(Number(after.unit_price))}, коригування ${after.adjustment_percent}% = ${formatPrice(Number(after.line_total))}`;
        return description + (before && typeof before !== 'string' ? ` (було ${formatPrice(Number(before.line_total))})` : '') + (after.note ? ` · ${after.note}` : '');
    }
    if (before && typeof before !== 'string') return `${before.name} · ${formatPrice(Number(before.line_total))}`;
    return [d.name || (event.action === 'payment' ? 'Аванс проєкту' : ''), d.amount !== undefined ? formatPrice(Number(d.amount)) : '', d.note].filter(Boolean).join(' · ');
}

export function ProjectEstimate({ projectId, userId, onProjectChange, openPriceList }: {
    projectId: string; userId: string; onProjectChange: (project: Project) => void; openPriceList: () => void;
}) {
    const [detail, setDetail] = useState<ProjectDetail | null>(null);
    const [services, setServices] = useState<Service[]>([]);
    const [catalogueError, setCatalogueError] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [busy, setBusy] = useState(false);
    const busyRef = useRef(false);
    const pending = useRef<Request | null>(null);
    const [needsRetry, setNeedsRetry] = useState(false);
    const [itemForm, setItemForm] = useState(false);
    const [editing, setEditing] = useState<EstimateItem | null>(null);
    const [serviceId, setServiceId] = useState('');
    const [search, setSearch] = useState('');
    const [quantity, setQuantity] = useState('1');
    const [price, setPrice] = useState('0');
    const [adjustment, setAdjustment] = useState('0');
    const [note, setNote] = useState('');
    const [action, setAction] = useState<Action | null>(null);
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState('');
    const [actionNote, setActionNote] = useState('');
    const loadId = useRef(0);
    const selectedService = services.find((service) => service.id === serviceId);
    const preview = calculateLineTotal(quantity, editing ? price : String(selectedService?.price ?? 0), adjustment);
    const balance = detail ? projectBalance(detail) : { unallocated: 0, remaining: 0, overpaid: 0 };
    const disabled = busy || needsRetry;

    const reload = useCallback(async () => {
        const id = ++loadId.current;
        setLoading(true); setError('');
        try {
            const client = createSupabaseBrowserClient();
            if (!client) throw new Error('Підключення недоступне.');
            const { data: auth } = await client.auth.getUser();
            if (auth.user?.id !== userId) throw new Error('Акаунт змінився або сесія завершилась. Оновіть сторінку.');
            const [result, catalogue] = await Promise.all([
                client.rpc('project_detail', { p_project_id: projectId }),
                client.from('services').select('*').eq('user_id', userId).order('name'),
            ]);
            if (id !== loadId.current) return;
            if (result.error) throw new Error(estimateError(result.error));
            const data = result.data as ProjectDetail;
            setDetail(data); onProjectChange(data.project);
            setServices((catalogue.data ?? []) as Service[]);
            setCatalogueError(catalogue.error ? 'Не вдалося завантажити ваш прайс. Оновіть дані перед додаванням робіт.' : '');
            pending.current = null; setNeedsRetry(false);
        } catch (cause) { if (id === loadId.current) setError(cause instanceof Error ? cause.message : estimateError({})); }
        finally { if (id === loadId.current) setLoading(false); }
    }, [projectId, userId, onProjectChange]);
    useEffect(() => { void reload(); return () => { loadId.current++; }; }, [reload]);

    async function mutate(kind: string, payload: Record<string, unknown>, retry = false) {
        if (busyRef.current || !detail) return;
        if (needsRetry && !retry) return;
        busyRef.current = true; setBusy(true); setError(''); setNotice('');
        const request = retry && pending.current ? pending.current : { action: kind, payload: { ...payload, version: detail.project.version }, id: crypto.randomUUID() };
        pending.current = request;
        try {
            const client = createSupabaseBrowserClient();
            if (!client) throw new Error('Підключення недоступне.');
            const { data: auth } = await client.auth.getUser();
            if (auth.user?.id !== userId) throw new Error('Акаунт змінився або сесія завершилась. Оновіть сторінку.');
            const result = await client.rpc('project_mutate', { p_project_id: projectId, p_action: request.action, p_payload: request.payload, p_request_id: request.id });
            if (result.error) {
                if (result.error.code && result.error.code !== '') { pending.current = null; setNeedsRetry(false); }
                else setNeedsRetry(true);
                throw new Error(estimateError(result.error));
            }
            const next = result.data as ProjectDetail;
            setDetail(next); onProjectChange(next.project);
            pending.current = null; setNeedsRetry(false); setItemForm(false); setAction(null);
            setNotice('Збережено. Підсумки проєкту оновлені.');
        } catch (cause) {
            if (pending.current) setNeedsRetry(true);
            setError(cause instanceof Error ? cause.message : estimateError({}));
        } finally { busyRef.current = false; setBusy(false); }
    }
    function openItem(item?: EstimateItem) {
        setEditing(item ?? null); setServiceId(''); setSearch(''); setQuantity(String(item?.quantity ?? 1));
        setPrice(String(item?.unit_price ?? 0)); setAdjustment(String(item?.adjustment_percent ?? 0)); setNote(item?.note ?? '');
        setItemForm(true); setAction(null); setError(''); setNotice('');
    }
    function openAction(next: Action) {
        setAction(next); setItemForm(false); setError(''); setNotice(''); setDate(localDateTime()); setActionNote('');
        const remaining = next.item ? Math.max(0, Math.round((Number(next.item.line_total) - Number(next.item.paid_amount)) * 100) / 100) : 0;
        setAmount(next.item ? String(next.kind === 'allocate' ? Math.min(remaining, balance.unallocated) : remaining) : '');
    }
    async function saveItem(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (preview === null || (!editing && !selectedService)) { setError('Оберіть послугу й перевірте кількість, ціну та коригування.'); return; }
        await mutate(editing ? 'edit_item' : 'add_item', { item_id: editing?.id, service_id: serviceId || undefined, quantity, unit_price: editing ? price : undefined, adjustment_percent: adjustment, note });
    }
    async function saveAction(event: FormEvent<HTMLFormElement>) {
        event.preventDefault(); if (!action) return;
        const parsed = new Date(date);
        if (!Number.isFinite(parsed.getTime()) || parsed.getTime() > Date.now() + 300000) { setError('Вкажіть коректну дату, що вже настала.'); return; }
        await mutate(action.kind, { item_id: action.item?.id, payment_id: action.payment?.id, amount, occurred_at: parsed.toISOString(), note: actionNote, completed: action.kind === 'complete_item' ? !action.item?.completed_at : undefined });
    }

    return <section className="estimate-section" aria-label="Кошторис проєкту">
        <div className="panel-heading estimate-heading"><div><span className="eyebrow">КОШТОРИС І ОПЛАТИ</span><h2>{detail?.project.name ?? 'Завантажуємо проєкт…'}</h2>{detail && <p>Створено {displayDate(detail.project.created_at)} · оновлено {displayDate(detail.project.updated_at)}</p>}</div><Button variant="outline" size="sm" disabled={busy || loading} onClick={() => { setItemForm(false); setAction(null); void reload(); }}><RefreshCw size={15} />Оновити</Button></div>
        {error && <div role="alert" className="workspace-error"><p>{error}</p>{needsRetry && <Button variant="outline" className="mt-3" disabled={busy} onClick={() => void mutate('', {}, true)}>Повторити той самий запит</Button>}</div>}
        {notice && <p role="status" className="workspace-notice">{notice}</p>}
        {loading ? <p role="status">Завантажуємо кошторис…</p> : detail && <>
            <div className="estimate-summary">{[['Кошторис', detail.project.total], ['Отримано від замовника', detail.project.paid], ['До сплати', balance.remaining], ['Нерозподілений аванс', balance.unallocated]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{formatPrice(Number(value))}</strong></div>)}</div>
            {balance.overpaid > 0 && <p className="workspace-notice">Кредит замовника: {formatPrice(balance.overpaid)}. Отримані кошти перевищують поточний кошторис; їх можна врахувати для наступних робіт.</p>}
            <p className="estimate-help">Аванс уже врахований у загальному залишку. Зарахуйте його на обрані роботи, щоб позначити їх оплаченими — повторно додавати отримані гроші не потрібно.</p>
            <div className="estimate-toolbar"><label>Статус проєкту<select aria-label="Статус проєкту" className="workspace-input" value={detail.project.status} disabled={disabled} onChange={(event) => void mutate('status', { status: event.target.value })}>{projectStatuses.map((status) => <option key={status}>{status}</option>)}</select></label><div><Button variant="outline" disabled={disabled} onClick={() => openAction({ kind: 'payment' })}><Wallet size={17} />Внести аванс</Button><Button className="workspace-primary" disabled={disabled} onClick={() => openItem()}><Plus size={17} />Додати роботу</Button></div></div>
            {catalogueError && <p role="alert" className="workspace-error">{catalogueError}</p>}
            {itemForm && <section className="workspace-panel project-form-panel"><div className="panel-heading"><div><h2>{editing ? `Редагувати: ${editing.name}` : 'Додати роботу з прайсу'}</h2><p>Ціна зберігається в цьому проєкті. Подальша зміна прайсу її не змінить.</p></div><button className="icon-button" aria-label="Закрити роботу" disabled={disabled} onClick={() => setItemForm(false)}><X size={18} /></button></div>
                {!editing && !services.length ? <div className="category-help"><p>Спочатку додайте послуги та ціни у свій прайс.</p><Button variant="outline" className="mt-3" onClick={openPriceList}>Відкрити послуги та ціни</Button></div> : <form onSubmit={saveItem}>
                    <fieldset className="project-form-fields" disabled={disabled}>
                        {!editing && <><label>Пошук у прайсі<input className="workspace-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Назва послуги" /></label><label>Послуга<select className="workspace-input" required value={serviceId} onChange={(event) => setServiceId(event.target.value)}><option value="">Оберіть послугу</option>{services.filter((service) => service.id === serviceId || service.name.toLocaleLowerCase('uk-UA').includes(search.toLocaleLowerCase('uk-UA'))).map((service) => <option key={service.id} value={service.id}>{service.name} · {formatPrice(Number(service.price))}/{serviceUnits[service.unit]}</option>)}</select></label></>}
                        <label>Кількість {editing || selectedService ? `(${serviceUnits[(editing ?? selectedService)!.unit]})` : ''}<input className="workspace-input" type="number" min="0.001" max="999999999.999" step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></label>
                        <label>Ціна за одиницю, ₴<input className="workspace-input" type="number" min="0" max="9999999999.99" step="0.01" readOnly={!editing} value={editing ? price : selectedService?.price ?? 0} onChange={(event) => setPrice(event.target.value)} required /></label>
                        <label>Знижка / націнка, %<input className="workspace-input" type="number" min="-100" max="1000" step="0.01" value={adjustment} onChange={(event) => setAdjustment(event.target.value)} required /><small>Наприклад, −10 — знижка, +15 — складність.</small></label>
                        <label>Примітка<input className="workspace-input" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} placeholder="Особливості роботи чи причина націнки" /></label>
                    </fieldset><div className="estimate-preview">Сума пункту <strong>{preview === null ? 'Перевірте значення' : formatPrice(preview)}</strong></div><div className="form-actions"><Button type="button" variant="ghost" disabled={disabled} onClick={() => setItemForm(false)}>Скасувати</Button><Button type="submit" className="workspace-primary" disabled={disabled || preview === null}>{busy ? 'Зберігаємо…' : 'Зберегти роботу'}</Button></div>
                </form>}
            </section>}
            {action && <section className="workspace-panel project-form-panel"><div className="panel-heading"><div><h2>{action.kind === 'payment' ? action.item ? 'Нова оплата за роботу' : 'Аванс за весь проєкт' : action.kind === 'allocate' ? 'Зарахувати отриманий аванс' : action.kind === 'complete_item' ? action.item?.completed_at ? 'Повернути роботу до невиконаних' : 'Позначити роботу виконаною' : action.kind === 'void_payment' ? 'Скасувати помилковий запис оплати' : 'Повернути аванс до нерозподіленого залишку'}</h2><p>{action.item?.name ?? 'Усі зміни зберігаються в історії.'}</p></div><button className="icon-button" aria-label="Закрити дію" disabled={disabled} onClick={() => setAction(null)}><X size={18} /></button></div>
                <form onSubmit={saveAction}><fieldset className="project-form-fields" disabled={disabled}>
                    {(action.kind === 'payment' || action.kind === 'allocate') && <label>Сума, ₴<input className="workspace-input" type="number" min="0.01" step="0.01" max={action.item ? Math.min(Math.round((Number(action.item.line_total) - Number(action.item.paid_amount)) * 100) / 100, action.kind === 'allocate' ? balance.unallocated : Infinity) : 9999999999.99} value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>}
                    <label>Дата й час події<input className="workspace-input" type="datetime-local" value={date} onChange={(event) => setDate(event.target.value)} required /><small>Місцевий час вашого пристрою.</small></label>
                    <label>{action.kind === 'void_payment' ? 'Причина скасування' : 'Примітка'}<input className="workspace-input" value={actionNote} onChange={(event) => setActionNote(event.target.value)} maxLength={500} required={action.kind === 'void_payment'} /></label>
                </fieldset>
                {action.kind === 'payment' && action.item && balance.unallocated > 0 && <div className="category-help">У проєкті є {formatPrice(balance.unallocated)} авансу. Якщо це вже отримані кошти, <button type="button" className="estimate-text-button" onClick={() => openAction({ kind: 'allocate', item: action.item })}>зарахуйте аванс замість нової оплати</button>.</div>}
                {action.kind === 'void_payment' && <p className="category-help">Це виправлення помилкового запису, а не повернення грошей замовнику. Усі зарахування цієї оплати також перестануть враховуватись.</p>}
                {action.kind === 'release_advance' && <p className="category-help">Гроші залишаться в проєкті. Зміниться лише їхнє зарахування на цю роботу.</p>}
                <div className="form-actions"><Button type="button" variant="ghost" disabled={disabled} onClick={() => setAction(null)}>Скасувати</Button><Button type="submit" className="workspace-primary" disabled={disabled}>{busy ? 'Зберігаємо…' : 'Підтвердити'}</Button></div></form>
            </section>}
            <div className="workspace-panel"><div className="panel-heading"><div><h2>Роботи <span className="count-badge">{detail.items.length}</span></h2><p>Виконання та оплата обліковуються незалежно.</p></div></div>
                {!detail.items.length ? <p className="category-help">Кошторис порожній. Додайте послугу, вкажіть обсяг — сума сформується автоматично.</p> : <div className="estimate-items">{detail.items.map((item) => {
                    const paid = Number(item.paid_amount), total = Number(item.line_total), isPaid = paid >= total;
                    const hasAdvance = detail.allocations.some((a) => a.item_id === item.id && !a.released_at && detail.payments.some((p) => p.id === a.payment_id && p.kind === 'advance' && !p.voided_at));
                    return <article className="estimate-item" key={item.id}><div className="estimate-item-top"><div><h3>{item.name}</h3><span className="estimate-meta">{item.category_name || 'Індивідуальна робота'} · додано {displayDate(item.created_at)}</span></div><div className="price-row-actions"><button className="icon-button" disabled={disabled} aria-label={`Редагувати ${item.name}`} onClick={() => openItem(item)}><Pencil size={16} /></button><button className="icon-button" disabled={disabled || paid > 0} title={paid > 0 ? 'Спочатку виправте оплату або поверніть аванс' : 'Видалити роботу'} aria-label={`Видалити ${item.name}`} onClick={() => { if (window.confirm(`Видалити «${item.name}» з кошторису? Подія залишиться в історії.`)) void mutate('delete_item', { item_id: item.id }); }}><Trash2 size={16} /></button></div></div>
                        <div className="estimate-calculation"><span>{item.quantity} {serviceUnits[item.unit]} × {formatPrice(Number(item.unit_price))}{Number(item.adjustment_percent) !== 0 && <em>{Number(item.adjustment_percent) > 0 ? '+' : ''}{item.adjustment_percent}%</em>}</span><strong>{formatPrice(total)}</strong></div>
                        {item.note && <p className="estimate-note">{item.note}</p>}
                        <div className="estimate-item-states"><button role="checkbox" aria-checked={!!item.completed_at} className="estimate-check" disabled={disabled} onClick={() => openAction({ kind: 'complete_item', item })}><span>{item.completed_at && <Check size={13} />}</span>Виконано</button><span className="estimate-meta">{item.completed_at ? displayDate(item.completed_at) : 'Ще в роботі'}</span><button role="checkbox" aria-checked={isPaid ? true : paid > 0 ? 'mixed' : false} className="estimate-check" disabled={disabled || isPaid} onClick={() => openAction({ kind: balance.unallocated > 0 ? 'allocate' : 'payment', item })}><span>{isPaid ? <Check size={13} /> : paid > 0 ? '−' : ''}</span>{isPaid ? total === 0 ? 'Без оплати' : 'Оплачено' : paid > 0 ? 'Частково оплачено' : 'Оплачено'}</button><span className="estimate-meta">{formatPrice(paid)} / {formatPrice(total)}</span></div>
                        <div className="estimate-item-actions">{!isPaid && <><Button size="sm" variant="outline" disabled={disabled} onClick={() => openAction({ kind: 'payment', item })}>Внести оплату</Button>{balance.unallocated > 0 && <Button size="sm" variant="ghost" disabled={disabled} onClick={() => openAction({ kind: 'allocate', item })}>Зарахувати аванс</Button>}</>}{hasAdvance && <Button size="sm" variant="ghost" disabled={disabled} onClick={() => openAction({ kind: 'release_advance', item })}>Повернути аванс у залишок</Button>}</div>
                    </article>;
                })}</div>}
                <div className="estimate-total"><span>Загальна вартість робіт</span><strong>{formatPrice(Number(detail.project.total))}</strong></div>
            </div>
            <section className="workspace-panel"><div className="panel-heading"><div><h2>Оплати замовника</h2><p>Скасовані записи зберігаються для перевірки історії.</p></div></div><div className="estimate-payments">{!detail.payments.length && <p className="estimate-help">Оплат ще немає.</p>}{detail.payments.map((payment) => <div key={payment.id} className={payment.voided_at ? 'payment-void' : ''}><div><strong>{formatPrice(Number(payment.amount))}</strong><span>{payment.kind === 'advance' ? 'Аванс проєкту' : String(detail.events.find((event) => event.action === 'payment' && event.details.payment_id === payment.id)?.details.name ?? 'Оплата роботи')} · {displayDate(payment.occurred_at)}</span>{payment.note && <p>{payment.note}</p>}{payment.voided_at && <p>Скасовано {displayDate(payment.voided_at)} · {payment.void_reason}</p>}<small>Записано {displayDate(payment.recorded_at)}</small></div>{!payment.voided_at && <Button size="sm" variant="ghost" disabled={disabled} onClick={() => openAction({ kind: 'void_payment', payment })}>Скасувати запис</Button>}</div>)}</div></section>
            <details className="workspace-panel estimate-history"><summary><Clock3 size={17} />Історія змін ({detail.events.length})</summary><ol>{detail.events.map((event) => <li key={event.id}><strong>{eventLabels[event.action] ?? event.action}</strong><p>{historyText(event)}</p><time>{displayDate(event.occurred_at)}</time><small>Записано {displayDate(event.recorded_at)}</small></li>)}</ol>{!detail.events.length && <p>Змін ще немає.</p>}</details>
        </>}
    </section>;
}
