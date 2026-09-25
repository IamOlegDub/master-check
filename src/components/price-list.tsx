'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { BusyIndicator } from '@/components/feedback';
import {
    Download,
    FolderPlus,
    Layers3,
    LoaderCircle,
    Pencil,
    Plus,
    Search,
    Trash2,
    X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import {
    formatPrice,
    priceListError,
    selectServices,
    serviceUnits,
    validateService,
    type Service,
    type ServiceCategory,
    type ServiceSort,
    type ServiceUnit,
} from '@/lib/price-list';

export function PriceList({ userId, userName }: { userId: string; userName: string }) {
    const [categories, setCategories] = useState<ServiceCategory[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [busy, setBusy] = useState(false);
    const busyRef = useRef(false);
    const [categoryId, setCategoryId] = useState('');
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState<ServiceSort>('category');
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Service | null>(null);
    const [showCategories, setShowCategories] = useState(false);
    const [categoryEditing, setCategoryEditing] = useState<ServiceCategory | null>(null);
    const [categoryName, setCategoryName] = useState('');
    const [exportScope, setExportScope] = useState('visible');
    const [exporting, setExporting] = useState(false);
    const exportRef = useRef(false);
    const [pdfName, setPdfName] = useState(userName);
    const [pdfContact, setPdfContact] = useState('');
    const loadVersion = useRef(0);
    const visible = selectServices(services, categories, categoryId, query, sort);
    const categoryNames = new Map(categories.map((category) => [category.id, category.name]));

    const reload = useCallback(async () => {
        const version = ++loadVersion.current;
        setLoading(true);
        setLoadError('');
        try {
            const supabase = createSupabaseBrowserClient();
            if (!supabase) throw new Error('Підключення недоступне. Оновіть сторінку.');
            const { data: auth, error: authError } = await supabase.auth.getUser();
            if (authError || auth.user?.id !== userId)
                throw new Error('Увійдіть повторно, щоб відкрити свій прайс-лист.');
            const [categoryResult, serviceResult] = await Promise.all([
                supabase.from('service_categories').select('*').eq('user_id', userId).order('name'),
                supabase
                    .from('services')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false }),
            ]);
            if (categoryResult.error) throw new Error(priceListError(categoryResult.error));
            if (serviceResult.error) throw new Error(priceListError(serviceResult.error));
            if (version !== loadVersion.current) return;
            setCategories(categoryResult.data as ServiceCategory[]);
            setServices(serviceResult.data as Service[]);
            setCategoryId((current) =>
                categoryResult.data.some((category) => category.id === current) ? current : '',
            );
        } catch (cause) {
            if (version === loadVersion.current)
                setLoadError(cause instanceof Error ? cause.message : priceListError({}));
        } finally {
            if (version === loadVersion.current) setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        void reload();
        return () => {
            loadVersion.current++;
        };
    }, [reload]);

    async function mutate(
        action: (
            client: NonNullable<ReturnType<typeof createSupabaseBrowserClient>>,
        ) => Promise<void>,
    ) {
        if (busyRef.current) return;
        busyRef.current = true;
        setBusy(true);
        setError('');
        setNotice('');
        try {
            const client = createSupabaseBrowserClient();
            if (!client) throw new Error('Підключення недоступне. Оновіть сторінку.');
            const { data, error: authError } = await client.auth.getUser();
            if (authError || data.user?.id !== userId)
                throw new Error('Сесія завершилася або акаунт змінився. Увійдіть повторно.');
            await action(client);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : priceListError({}));
        } finally {
            busyRef.current = false;
            setBusy(false);
        }
    }

    function openService(service: Service | null = null) {
        setEditing(service);
        setShowForm(true);
        setError('');
        setNotice('');
        if (!categories.length) setShowCategories(true);
    }

    async function saveCategory(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const name = categoryName.trim();
        if (!name || name.length > 80) {
            setError('Вкажіть назву категорії до 80 символів.');
            return;
        }
        await mutate(async (client) => {
            const result = categoryEditing
                ? await client
                      .from('service_categories')
                      .update({ name })
                      .eq('id', categoryEditing.id)
                      .eq('user_id', userId)
                      .select('*')
                      .single()
                : await client
                      .from('service_categories')
                      .insert({ name, user_id: userId })
                      .select('*')
                      .single();
            if (result.error) throw new Error(priceListError(result.error));
            const category = result.data as ServiceCategory;
            setCategories((current) =>
                [...current.filter((item) => item.id !== category.id), category].sort((a, b) =>
                    a.name.localeCompare(b.name, 'uk-UA'),
                ),
            );
            setCategoryName('');
            setCategoryEditing(null);
            setNotice(
                categoryEditing
                    ? 'Категорію оновлено.'
                    : 'Категорію додано. Тепер можна створити послугу.',
            );
        });
    }

    async function saveService(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const fields = new FormData(event.currentTarget);
        const name = String(fields.get('name') ?? '').trim();
        const price = String(fields.get('price') ?? '');
        const unit = String(fields.get('unit') ?? '');
        const chosenCategory = String(fields.get('category_id') ?? '');
        const validation = validateService(name, price, unit, chosenCategory);
        if (validation) {
            setError(validation);
            return;
        }
        if (!categories.some((category) => category.id === chosenCategory)) {
            setError('Оберіть доступну категорію.');
            return;
        }
        await mutate(async (client) => {
            const values = {
                name,
                price: Number(price),
                unit: unit as ServiceUnit,
                category_id: chosenCategory,
            };
            const result = editing
                ? await client
                      .from('services')
                      .update(values)
                      .eq('id', editing.id)
                      .eq('user_id', userId)
                      .select('*')
                      .single()
                : await client
                      .from('services')
                      .insert({ ...values, user_id: userId })
                      .select('*')
                      .single();
            if (result.error) throw new Error(priceListError(result.error));
            const service = result.data as Service;
            setServices((current) => [
                service,
                ...current.filter((item) => item.id !== service.id),
            ]);
            setShowForm(false);
            setEditing(null);
            setCategoryId('');
            setQuery('');
            setNotice(editing ? 'Послугу оновлено.' : 'Послугу додано до прайсу.');
        });
    }

    async function deleteService(service: Service) {
        if (!window.confirm(`Видалити послугу «${service.name}» з прайсу?`)) return;
        await mutate(async (client) => {
            const result = await client
                .from('services')
                .delete()
                .eq('id', service.id)
                .eq('user_id', userId)
                .select('id')
                .single();
            if (result.error) throw new Error(priceListError(result.error));
            setServices((current) => current.filter((item) => item.id !== service.id));
            if (editing?.id === service.id) {
                setEditing(null);
                setShowForm(false);
            }
            setNotice('Послугу видалено.');
        });
    }

    async function deleteCategory(category: ServiceCategory) {
        if (!window.confirm(`Видалити порожню категорію «${category.name}»?`)) return;
        await mutate(async (client) => {
            const result = await client
                .from('service_categories')
                .delete()
                .eq('id', category.id)
                .eq('user_id', userId)
                .select('id')
                .single();
            if (result.error) throw new Error(priceListError(result.error));
            setCategories((current) => current.filter((item) => item.id !== category.id));
            if (categoryId === category.id) setCategoryId('');
            if (categoryEditing?.id === category.id) {
                setCategoryEditing(null);
                setCategoryName('');
            }
            setNotice('Категорію видалено.');
        });
    }

    async function exportPdf() {
        if (exportRef.current) return;
        const rows =
            exportScope === 'all'
                ? selectServices(services, categories, '', '', 'category')
                : visible;
        if (!rows.length) return;
        exportRef.current = true;
        setExporting(true);
        setError('');
        try {
            const { downloadPriceListPdf } = await import('@/lib/price-list-pdf');
            await downloadPriceListPdf({
                services: rows,
                categories,
                author: pdfName.trim() || userName,
                contact: pdfContact.trim(),
            });
            setNotice('PDF-прайс сформовано. Файл можна надіслати замовнику.');
        } catch {
            setError('Не вдалося сформувати PDF. Перевірте з’єднання та спробуйте ще раз.');
        } finally {
            exportRef.current = false;
            setExporting(false);
        }
    }

    return (
        <div className="price-list grid gap-5 min-w-0 [&_.icon-button:disabled]:opacity-[.35]">
            <BusyIndicator busy={busy} />
            <div className="price-actions flex items-center justify-between gap-3.5 flex-wrap [&_>_p]:text-subtle [&_>_p]:text-[12px] [&_>_div]:flex [&_>_div]:gap-2.5 [&_>_div]:flex-wrap max-[761px]:[&_>_div]:w-full max-[761px]:[&_button]:flex-1">
                <p>Ваші навички. Ваші ціни.</p>
                <div>
                    <Button
                        variant="outline"
                        onClick={() => setShowCategories((current) => !current)}
                        disabled={loading || !!loadError || busy}
                    >
                        <FolderPlus size={17} />
                        Категорії
                    </Button>
                    <Button
                        variant="brand"
                        onClick={() => openService()}
                        disabled={loading || !!loadError || busy}
                    >
                        <Plus size={17} />
                        Додати послугу
                    </Button>
                </div>
            </div>
            {notice && (
                <p
                    role="status"
                    className="workspace-notice rounded-[10px] py-[15px] px-4.5 text-[12px] leading-[1.6] text-[var(--tone-text-34755c)] bg-[var(--tone-bg-edf7f1)] border border-[var(--tone-border-d7eddf)]"
                >
                    {notice}
                </p>
            )}
            {error && (
                <p
                    role="alert"
                    className="workspace-error rounded-[10px] py-[15px] px-4.5 text-[12px] leading-[1.6] text-[var(--tone-text-a14752)] bg-[var(--tone-bg-fcf0f1)] border border-[var(--tone-border-f1dce0)]"
                >
                    {error}
                </p>
            )}
            {loading ? (
                <p
                    role="status"
                    className="price-loading flex items-center gap-2.5 py-7.5 px-0 text-subtle"
                >
                    <LoaderCircle className="animate-spin" size={20} />
                    Завантажуємо ваш прайс…
                </p>
            ) : loadError ? (
                <div
                    role="alert"
                    className="workspace-error rounded-[10px] py-[15px] px-4.5 text-[12px] leading-[1.6] text-[var(--tone-text-a14752)] bg-[var(--tone-bg-fcf0f1)] border border-[var(--tone-border-f1dce0)]"
                >
                    <p>{loadError}</p>
                    <Button variant="outline" className="mt-3" onClick={() => void reload()}>
                        Спробувати знову
                    </Button>
                </div>
            ) : (
                <>
                    {showCategories && (
                        <section className="workspace-panel bg-[var(--tone-bg-ffffff)] border border-line rounded-[14px] min-w-0">
                            <div className="panel-heading flex justify-between items-start gap-4 pt-[25px] px-6 pb-5 [&_h2]:flex [&_h2]:items-center [&_h2]:gap-[9px] [&_h2]:text-[16px] [&_h2]:font-semibold [&_h2]:tracking-[-.03em] [&_p]:text-subtle [&_p]:text-[11px] [&_p]:mt-[7px] max-[761px]:pt-[21px] max-[761px]:px-4.5 max-[761px]:pb-4.5">
                                <div>
                                    <h2>Ваші категорії</h2>
                                    <p>
                                        Створіть власні напрями: плитка, дерево, сантехніка або
                                        будь-які інші.
                                    </p>
                                </div>
                                <button
                                    className="icon-button inline-flex items-center justify-center w-8 h-8 rounded-[8px] text-subtle shrink-0 [&:hover]:bg-[var(--tone-bg-f1f1f8)]"
                                    aria-label="Закрити категорії"
                                    onClick={() => setShowCategories(false)}
                                >
                                    <X size={19} />
                                </button>
                            </div>
                            <form
                                onSubmit={saveCategory}
                                className="category-form flex items-end gap-3 pt-0 px-6 pb-5 flex-wrap [&_label]:flex-1 [&_label]:min-w-47.5 [&_label]:text-[12px] [&_label]:text-[var(--tone-text-55596c)] max-[761px]:px-4.5"
                            >
                                <label>
                                    {categoryEditing
                                        ? 'Нова назва категорії'
                                        : 'Назва нової категорії'}
                                    <input
                                        className="workspace-input block w-full border border-[var(--tone-border-e2e4ed)] rounded-[8px] bg-[var(--tone-bg-fcfcfe)] py-[11px] px-3 mt-2 text-ink text-[13px] font-normal outline-none [transition:border-color_.15s] [&::placeholder]:text-[var(--tone-text-a1a4b0)] [&:focus]:border-[var(--tone-border-9b8ee1)] [&:focus]:bg-[var(--tone-bg-ffffff)] max-[761px]:text-[16px]"
                                        value={categoryName}
                                        onChange={(event) => setCategoryName(event.target.value)}
                                        placeholder="Наприклад, сантехніка"
                                        required
                                        maxLength={80}
                                        disabled={busy}
                                    />
                                </label>
                                <Button type="submit" variant="brand" disabled={busy}>
                                    {categoryEditing ? 'Зберегти' : 'Додати категорію'}
                                </Button>
                                {categoryEditing && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        disabled={busy}
                                        onClick={() => {
                                            setCategoryEditing(null);
                                            setCategoryName('');
                                        }}
                                    >
                                        Скасувати
                                    </Button>
                                )}
                            </form>
                            <div className="category-manager grid grid-cols-2 gap-2.5 pt-0 px-6 pb-5 [&_>_div]:flex [&_>_div]:items-center [&_>_div]:gap-[5px] [&_>_div]:py-2.5 [&_>_div]:px-3 [&_>_div]:border [&_>_div]:border-line [&_>_div]:rounded-[9px] [&_>_div_>_span]:flex-1 [&_>_div_>_span]:min-w-0 [&_>_div_>_span]:wrap-anywhere [&_>_div_>_span]:text-[12px] [&_small]:block [&_small]:text-subtle [&_small]:text-[10px] [&_small]:mt-[3px] max-[761px]:grid-cols-[1fr] max-[761px]:px-4.5">
                                {categories.map((category) => {
                                    const count = services.filter(
                                        (service) => service.category_id === category.id,
                                    ).length;
                                    return (
                                        <div key={category.id}>
                                            <span>
                                                {category.name}
                                                <small>{count} послуг</small>
                                            </span>
                                            <button
                                                className="icon-button inline-flex items-center justify-center w-8 h-8 rounded-[8px] text-subtle shrink-0 [&:hover]:bg-[var(--tone-bg-f1f1f8)]"
                                                disabled={busy}
                                                aria-label={`Перейменувати ${category.name}`}
                                                onClick={() => {
                                                    setCategoryEditing(category);
                                                    setCategoryName(category.name);
                                                }}
                                            >
                                                <Pencil size={15} />
                                            </button>
                                            <button
                                                className="icon-button inline-flex items-center justify-center w-8 h-8 rounded-[8px] text-subtle shrink-0 [&:hover]:bg-[var(--tone-bg-f1f1f8)]"
                                                disabled={busy || count > 0}
                                                title={
                                                    count
                                                        ? 'Спочатку перенесіть або видаліть послуги цієї категорії'
                                                        : 'Видалити категорію'
                                                }
                                                aria-label={`Видалити категорію ${category.name}`}
                                                onClick={() => void deleteCategory(category)}
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                            <p className="category-help pt-0 px-6 pb-5 text-subtle text-[11px] leading-[1.7]">
                                Категорію з послугами можна видалити після перенесення або видалення
                                її послуг.
                            </p>
                        </section>
                    )}
                    {showForm && (
                        <section className="workspace-panel bg-[var(--tone-bg-ffffff)] border border-line rounded-[14px] min-w-0 project-form-panel border-[var(--tone-border-ddd7f5)]! shadow-[0_5px_20px_#6155db06] [&_.eyebrow]:mb-[7px] [&_.workspace-error]:mt-0 [&_.workspace-error]:mx-6 [&_.workspace-error]:mb-5">
                            <div className="panel-heading flex justify-between items-start gap-4 pt-[25px] px-6 pb-5 [&_h2]:flex [&_h2]:items-center [&_h2]:gap-[9px] [&_h2]:text-[16px] [&_h2]:font-semibold [&_h2]:tracking-[-.03em] [&_p]:text-subtle [&_p]:text-[11px] [&_p]:mt-[7px] max-[761px]:pt-[21px] max-[761px]:px-4.5 max-[761px]:pb-4.5">
                                <div>
                                    <h2>{editing ? 'Редагувати послугу' : 'Нова послуга'}</h2>
                                    <p>Вартість за одну обрану одиницю. Валюта — гривня.</p>
                                </div>
                                <button
                                    className="icon-button inline-flex items-center justify-center w-8 h-8 rounded-[8px] text-subtle shrink-0 [&:hover]:bg-[var(--tone-bg-f1f1f8)]"
                                    disabled={busy}
                                    aria-label="Закрити форму послуги"
                                    onClick={() => setShowForm(false)}
                                >
                                    <X size={19} />
                                </button>
                            </div>
                            {!categories.length ? (
                                <p className="category-help pt-0 px-6 pb-5 text-subtle text-[11px] leading-[1.7]">
                                    Спочатку додайте хоча б одну категорію у блоці вище.
                                </p>
                            ) : (
                                <form key={editing?.id ?? 'new'} onSubmit={saveService}>
                                    <fieldset
                                        disabled={busy}
                                        className="project-form-fields grid grid-cols-[1fr_1fr] gap-5 pt-1 px-6 pb-6 [&_label]:text-[var(--tone-text-55596c)] [&_label]:text-[12px] [&_label]:font-medium [&_label]:min-w-0 max-[761px]:grid-cols-[1fr] max-[761px]:px-4.5 max-[761px]:gap-[17px]"
                                    >
                                        <label>
                                            Назва послуги
                                            <input
                                                autoFocus
                                                name="name"
                                                className="workspace-input block w-full border border-[var(--tone-border-e2e4ed)] rounded-[8px] bg-[var(--tone-bg-fcfcfe)] py-[11px] px-3 mt-2 text-ink text-[13px] font-normal outline-none [transition:border-color_.15s] [&::placeholder]:text-[var(--tone-text-a1a4b0)] [&:focus]:border-[var(--tone-border-9b8ee1)] [&:focus]:bg-[var(--tone-bg-ffffff)] max-[761px]:text-[16px]"
                                                required
                                                maxLength={160}
                                                defaultValue={editing?.name ?? ''}
                                                placeholder="Наприклад, укладання плитки"
                                            />
                                        </label>
                                        <label>
                                            Категорія
                                            <select
                                                name="category_id"
                                                className="workspace-input block w-full border border-[var(--tone-border-e2e4ed)] rounded-[8px] bg-[var(--tone-bg-fcfcfe)] py-[11px] px-3 mt-2 text-ink text-[13px] font-normal outline-none [transition:border-color_.15s] [&::placeholder]:text-[var(--tone-text-a1a4b0)] [&:focus]:border-[var(--tone-border-9b8ee1)] [&:focus]:bg-[var(--tone-bg-ffffff)] max-[761px]:text-[16px]"
                                                required
                                                defaultValue={
                                                    editing?.category_id ??
                                                    (categoryId || categories[0]?.id)
                                                }
                                            >
                                                {categories.map((category) => (
                                                    <option key={category.id} value={category.id}>
                                                        {category.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                        <label>
                                            Ціна за одиницю, ₴
                                            <input
                                                name="price"
                                                className="workspace-input block w-full border border-[var(--tone-border-e2e4ed)] rounded-[8px] bg-[var(--tone-bg-fcfcfe)] py-[11px] px-3 mt-2 text-ink text-[13px] font-normal outline-none [transition:border-color_.15s] [&::placeholder]:text-[var(--tone-text-a1a4b0)] [&:focus]:border-[var(--tone-border-9b8ee1)] [&:focus]:bg-[var(--tone-bg-ffffff)] max-[761px]:text-[16px]"
                                                type="number"
                                                inputMode="decimal"
                                                min="0"
                                                max="9999999999"
                                                step="1"
                                                required
                                                defaultValue={editing?.price ?? ''}
                                                placeholder="0,00"
                                            />
                                        </label>
                                        <label>
                                            Одиниця виміру
                                            <select
                                                name="unit"
                                                className="workspace-input block w-full border border-[var(--tone-border-e2e4ed)] rounded-[8px] bg-[var(--tone-bg-fcfcfe)] py-[11px] px-3 mt-2 text-ink text-[13px] font-normal outline-none [transition:border-color_.15s] [&::placeholder]:text-[var(--tone-text-a1a4b0)] [&:focus]:border-[var(--tone-border-9b8ee1)] [&:focus]:bg-[var(--tone-bg-ffffff)] max-[761px]:text-[16px]"
                                                defaultValue={editing?.unit ?? 'm2'}
                                            >
                                                {Object.entries(serviceUnits).map(
                                                    ([value, label]) => (
                                                        <option key={value} value={value}>
                                                            {label}
                                                        </option>
                                                    ),
                                                )}
                                            </select>
                                        </label>
                                    </fieldset>
                                    <div className="form-actions py-4.5 px-6 border-t border-line flex justify-end gap-2.5 max-[761px]:px-4.5">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            disabled={busy}
                                            onClick={() => setShowForm(false)}
                                        >
                                            Скасувати
                                        </Button>
                                        <Button type="submit" variant="brand" disabled={busy}>
                                            {busy
                                                ? 'Зберігаємо…'
                                                : editing
                                                  ? 'Зберегти зміни'
                                                  : 'Додати до прайсу'}
                                        </Button>
                                    </div>
                                </form>
                            )}
                        </section>
                    )}
                    {services.length === 0 ? (
                        <section className="workspace-panel bg-[var(--tone-bg-ffffff)] border border-line rounded-[14px] min-w-0 empty-projects py-14.5 px-6 text-center [&_h2]:text-[23px] [&_h2]:font-[550] [&_h2]:tracking-[-.04em] [&_h2]:my-2.5 [&_h2]:mx-0 [&_>_p]:text-[12px] [&_>_p]:leading-[1.9] [&_>_p]:text-subtle [&_>_p]:max-w-92.5 [&_>_p]:mt-0 [&_>_p]:mx-auto [&_>_p]:mb-[25px] max-[761px]:py-[45px] max-[761px]:px-4.5 max-[761px]:[&_h2]:text-[22px]">
                            <div className="empty-art relative flex items-center justify-center w-21.5 h-21.5 rounded-[24px] mt-0 mx-auto mb-7.5 bg-[var(--tone-bg-f1effb)] text-[var(--tone-text-8d7ec9)] border border-[var(--tone-border-e8e3f7)] rotate-[-6deg] [&_>_svg]:rotate-[6deg] [&_i]:inline-flex [&_i]:absolute [&_i]:bottom-[-5px] [&_i]:right-[-7px] [&_i]:p-1.5 [&_i]:bg-[#6155db] [&_i]:text-white [&_i]:rounded-[9px] [&_i]:border-3 [&_i]:border-[var(--tone-border-ffffff)]">
                                <Layers3 size={35} strokeWidth={1.3} />
                            </div>
                            <span className="eyebrow block text-[var(--tone-text-89859e)] text-[9px] font-semibold tracking-[.13em]">
                                ВАША РОБОТА МАЄ ЦІНУ
                            </span>
                            <h2>Створіть свій прайс-лист</h2>
                            <p>
                                Додайте категорії та послуги. Готовий прайс можна завантажити в PDF
                                для замовника.
                            </p>
                            <Button
                                variant="brand"
                                onClick={() =>
                                    categories.length ? openService() : setShowCategories(true)
                                }
                            >
                                <Plus size={17} />
                                {categories.length
                                    ? 'Додати першу послугу'
                                    : 'Створити першу категорію'}
                            </Button>
                        </section>
                    ) : (
                        <>
                            <section className="workspace-panel bg-[var(--tone-bg-ffffff)] border border-line rounded-[14px] min-w-0">
                                <div className="panel-heading flex justify-between items-start gap-4 pt-[25px] px-6 pb-5 [&_h2]:flex [&_h2]:items-center [&_h2]:gap-[9px] [&_h2]:text-[16px] [&_h2]:font-semibold [&_h2]:tracking-[-.03em] [&_p]:text-subtle [&_p]:text-[11px] [&_p]:mt-[7px] max-[761px]:pt-[21px] max-[761px]:px-4.5 max-[761px]:pb-4.5">
                                    <div>
                                        <h2>
                                            Послуги та ціни{' '}
                                            <span className="count-badge inline-flex py-[1px] px-[7px] bg-[var(--tone-bg-f2f1f8)] text-[var(--tone-text-817793)] rounded-[5px] text-[10px]">
                                                {services.length}
                                            </span>
                                        </h2>
                                        <p>Оберіть напрям або знайдіть потрібну послугу.</p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled={busy}
                                        onClick={() => {
                                            setShowForm(false);
                                            void reload();
                                        }}
                                    >
                                        Оновити
                                    </Button>
                                </div>
                                <div className="price-filters flex flex-wrap gap-2.5 pt-0 px-6 pb-5 [&_.project-search]:basis-45 [&_>_select]:border [&_>_select]:border-line [&_>_select]:rounded-[8px] [&_>_select]:p-[9px] [&_>_select]:bg-[var(--tone-bg-ffffff)] [&_>_select]:text-[var(--tone-text-717486)] [&_>_select]:text-[12px] [&_>_select]:max-w-full max-[761px]:px-4.5">
                                    <label className="grid min-w-0 flex-1 basis-52 gap-2 text-xs text-ink">
                                        <span className="text-xs text-ink">Пошук послуг</span>
                                        <span className="flex min-h-11 items-center gap-2 rounded-lg border border-line px-3 focus-within:border-brand">
                                            <Search size={17} className="shrink-0 text-subtle" />
                                            <input
                                                className="min-w-0 w-full outline-none"
                                                value={query}
                                                onChange={(event) => setQuery(event.target.value)}
                                                placeholder="Знайти послугу…"
                                                aria-label="Пошук послуг"
                                            />
                                        </span>
                                    </label>
                                    <label className="grid gap-2 text-xs">
                                        Категорія
                                        <select
                                            className="min-h-11 rounded-lg border border-line bg-card px-3"
                                            aria-label="Категорія послуг"
                                            value={categoryId}
                                            onChange={(event) => setCategoryId(event.target.value)}
                                        >
                                            <option value="">Усі категорії</option>
                                            {categories.map((category) => (
                                                <option key={category.id} value={category.id}>
                                                    {category.name}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="grid gap-2 text-xs">
                                        Сортування
                                        <select
                                            className="min-h-11 max-w-full rounded-lg border border-line bg-card px-3"
                                            aria-label="Сортування послуг"
                                            value={sort}
                                            onChange={(event) =>
                                                setSort(event.target.value as ServiceSort)
                                            }
                                        >
                                            <option value="category">За категоріями</option>
                                            <option value="name">Назва: А–Я</option>
                                            <option value="name-desc">Назва: Я–А</option>
                                            <option value="category-desc">Категорії: Я–А</option>
                                            <option value="unit">Одиниці: А–Я</option>
                                            <option value="unit-desc">Одиниці: Я–А</option>
                                            <option value="price-asc">Ціна: від нижчої</option>
                                            <option value="price-desc">Ціна: від вищої</option>
                                        </select>
                                    </label>
                                </div>
                                <div className="price-table-wrap overflow-x-auto max-[761px]:overflow-visible">
                                    <table className="price-table block w-full border-collapse text-xs min-[761px]:table">
                                        <thead className="max-[761px]:sr-only">
                                            <tr>
                                                <th
                                                    className="border-y border-line bg-[var(--tone-bg-fafafe)] px-[18px] py-3 text-left text-[10px] font-medium text-[var(--tone-text-838597)] [&:nth-child(4)]:text-right"
                                                    scope="col"
                                                    aria-sort={
                                                        sort === 'name'
                                                            ? 'ascending'
                                                            : sort === 'name-desc'
                                                              ? 'descending'
                                                              : 'none'
                                                    }
                                                >
                                                    <button
                                                        className="inline-flex items-center gap-2 py-1"
                                                        onClick={() =>
                                                            setSort(
                                                                sort === 'name'
                                                                    ? 'name-desc'
                                                                    : 'name',
                                                            )
                                                        }
                                                    >
                                                        Послуга
                                                        <span aria-hidden>
                                                            {sort === 'name'
                                                                ? '↑'
                                                                : sort === 'name-desc'
                                                                  ? '↓'
                                                                  : '↕'}
                                                        </span>
                                                    </button>
                                                </th>
                                                <th
                                                    className="border-y border-line bg-[var(--tone-bg-fafafe)] px-[18px] py-3 text-left text-[10px] font-medium text-[var(--tone-text-838597)] [&:nth-child(4)]:text-right"
                                                    scope="col"
                                                    aria-sort={
                                                        sort === 'category'
                                                            ? 'ascending'
                                                            : sort === 'category-desc'
                                                              ? 'descending'
                                                              : 'none'
                                                    }
                                                >
                                                    <button
                                                        className="inline-flex items-center gap-2 py-1"
                                                        onClick={() =>
                                                            setSort(
                                                                sort === 'category'
                                                                    ? 'category-desc'
                                                                    : 'category',
                                                            )
                                                        }
                                                    >
                                                        Категорія
                                                        <span aria-hidden>
                                                            {sort === 'category'
                                                                ? '↑'
                                                                : sort === 'category-desc'
                                                                  ? '↓'
                                                                  : '↕'}
                                                        </span>
                                                    </button>
                                                </th>
                                                <th
                                                    className="border-y border-line bg-[var(--tone-bg-fafafe)] px-[18px] py-3 text-left text-[10px] font-medium text-[var(--tone-text-838597)] [&:nth-child(4)]:text-right"
                                                    scope="col"
                                                    aria-sort={
                                                        sort === 'unit'
                                                            ? 'ascending'
                                                            : sort === 'unit-desc'
                                                              ? 'descending'
                                                              : 'none'
                                                    }
                                                >
                                                    <button
                                                        className="inline-flex items-center gap-2 py-1"
                                                        onClick={() =>
                                                            setSort(
                                                                sort === 'unit'
                                                                    ? 'unit-desc'
                                                                    : 'unit',
                                                            )
                                                        }
                                                    >
                                                        Одиниця
                                                        <span aria-hidden>
                                                            {sort === 'unit'
                                                                ? '↑'
                                                                : sort === 'unit-desc'
                                                                  ? '↓'
                                                                  : '↕'}
                                                        </span>
                                                    </button>
                                                </th>
                                                <th
                                                    className="border-y border-line bg-[var(--tone-bg-fafafe)] px-[18px] py-3 text-left text-[10px] font-medium text-[var(--tone-text-838597)] [&:nth-child(4)]:text-right"
                                                    scope="col"
                                                    aria-sort={
                                                        sort === 'price-asc'
                                                            ? 'ascending'
                                                            : sort === 'price-desc'
                                                              ? 'descending'
                                                              : 'none'
                                                    }
                                                >
                                                    <button
                                                        className="inline-flex items-center gap-2 py-1"
                                                        onClick={() =>
                                                            setSort(
                                                                sort === 'price-asc'
                                                                    ? 'price-desc'
                                                                    : 'price-asc',
                                                            )
                                                        }
                                                    >
                                                        Ціна
                                                        <span aria-hidden>
                                                            {sort === 'price-asc'
                                                                ? '↑'
                                                                : sort === 'price-desc'
                                                                  ? '↓'
                                                                  : '↕'}
                                                        </span>
                                                    </button>
                                                </th>
                                                <th className="border-y border-line bg-[var(--tone-bg-fafafe)] px-[18px] py-3 text-left text-[10px] font-medium text-[var(--tone-text-838597)] [&:nth-child(4)]:text-right">
                                                    <span className="sr-only">Дії</span>
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="block min-[761px]:table-row-group">
                                            {visible.map((service) => (
                                                <tr
                                                    key={service.id}
                                                    className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 border-t border-line px-[18px] py-4 hover:bg-[var(--tone-bg-fcfbff)] min-[761px]:table-row min-[761px]:border-t-0 min-[761px]:p-0"
                                                >
                                                    <td className="block min-w-0 min-[761px]:table-cell min-[761px]:border-b min-[761px]:border-[var(--tone-border-f1f2f6)] min-[761px]:px-[18px] min-[761px]:py-4 col-span-full text-sm font-medium wrap-anywhere min-[761px]:min-w-[170px] min-[761px]:max-w-[400px] min-[761px]:text-xs">
                                                        {service.name}
                                                    </td>
                                                    <td className="block min-w-0 min-[761px]:table-cell min-[761px]:border-b min-[761px]:border-[var(--tone-border-f1f2f6)] min-[761px]:px-[18px] min-[761px]:py-4 col-span-full wrap-anywhere min-[761px]:max-w-[200px]">
                                                        <span className="price-category-label max-[761px]:wrap-anywhere inline-block py-1 px-2 rounded-[5px] text-[var(--tone-text-82739c)] bg-[var(--tone-bg-f3f0fa)] text-[10px]">
                                                            {categoryNames.get(
                                                                service.category_id,
                                                            ) ?? 'Без категорії'}
                                                        </span>
                                                    </td>
                                                    <td className="block min-w-0 min-[761px]:table-cell min-[761px]:border-b min-[761px]:border-[var(--tone-border-f1f2f6)] min-[761px]:px-[18px] min-[761px]:py-4 col-start-1 self-end text-subtle min-[761px]:whitespace-nowrap min-[761px]:text-ink">
                                                        {serviceUnits[service.unit]}
                                                    </td>
                                                    <td className="block min-w-0 min-[761px]:table-cell min-[761px]:border-b min-[761px]:border-[var(--tone-border-f1f2f6)] min-[761px]:px-[18px] min-[761px]:py-4 col-start-1 text-base font-semibold wrap-anywhere tabular-nums min-[761px]:text-right min-[761px]:text-xs min-[761px]:font-normal min-[761px]:whitespace-nowrap">
                                                        {formatPrice(service.price)}
                                                    </td>
                                                    <td className="block min-w-0 min-[761px]:table-cell min-[761px]:border-b min-[761px]:border-[var(--tone-border-f1f2f6)] min-[761px]:px-[18px] min-[761px]:py-4 col-start-2 row-start-3 row-end-5 self-center max-[761px]:[&_button]:size-11">
                                                        <div className="price-row-actions flex justify-end">
                                                            <button
                                                                className="icon-button inline-flex items-center justify-center w-8 h-8 rounded-[8px] text-subtle shrink-0 [&:hover]:bg-[var(--tone-bg-f1f1f8)]"
                                                                disabled={busy}
                                                                onClick={() => openService(service)}
                                                                aria-label={`Редагувати ${service.name}`}
                                                            >
                                                                <Pencil size={15} />
                                                            </button>
                                                            <button
                                                                className="icon-button inline-flex items-center justify-center w-8 h-8 rounded-[8px] text-subtle shrink-0 [&:hover]:bg-[var(--tone-bg-f1f1f8)]"
                                                                disabled={busy}
                                                                onClick={() =>
                                                                    void deleteService(service)
                                                                }
                                                                aria-label={`Видалити ${service.name}`}
                                                            >
                                                                <Trash2 size={15} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {!visible.length && (
                                    <div className="search-empty text-center py-7.5 px-2.5 text-subtle text-[12px] [&_svg]:mt-0 [&_svg]:mx-auto [&_svg]:mb-2.5 [&_h3]:font-[550] [&_h3]:text-ink [&_h3]:mb-1.5 [&_p]:mb-2.5">
                                        <h3>Послуг не знайдено</h3>
                                        <p>Змініть категорію або пошуковий запит.</p>
                                        <Button
                                            variant="ghost"
                                            onClick={() => {
                                                setCategoryId('');
                                                setQuery('');
                                            }}
                                        >
                                            Скинути фільтри
                                        </Button>
                                    </div>
                                )}
                                <div className="list-footer border-t border-line py-[13px] px-6 text-[var(--tone-text-989baa)] text-[10px]">
                                    Показано {visible.length} із {services.length} · ціни за одиницю
                                </div>
                            </section>
                            <section className="workspace-panel bg-[var(--tone-bg-ffffff)] border border-line rounded-[14px] min-w-0 pdf-panel">
                                <div className="panel-heading flex justify-between items-start gap-4 pt-[25px] px-6 pb-5 [&_h2]:flex [&_h2]:items-center [&_h2]:gap-[9px] [&_h2]:text-[16px] [&_h2]:font-semibold [&_h2]:tracking-[-.03em] [&_p]:text-subtle [&_p]:text-[11px] [&_p]:mt-[7px] max-[761px]:pt-[21px] max-[761px]:px-4.5 max-[761px]:pb-4.5">
                                    <div>
                                        <h2>
                                            <Download size={18} />
                                            Прайс для замовника
                                        </h2>
                                        <p>
                                            Завантажте PDF з назвами, категоріями, одиницями та
                                            цінами.
                                        </p>
                                    </div>
                                </div>
                                <div className="pdf-options grid grid-cols-[1fr_1fr] gap-4.5 items-end pt-0 px-6 pb-5 [&_label]:text-[var(--tone-text-55596c)] [&_label]:text-[12px] [&_label]:min-w-0 [&_>_button]:justify-self-end max-[761px]:grid-cols-[1fr] max-[761px]:px-4.5 max-[761px]:[&_>_button]:justify-self-stretch">
                                    <label>
                                        Ім’я майстра або компанія
                                        <input
                                            className="workspace-input block w-full border border-[var(--tone-border-e2e4ed)] rounded-[8px] bg-[var(--tone-bg-fcfcfe)] py-[11px] px-3 mt-2 text-ink text-[13px] font-normal outline-none [transition:border-color_.15s] [&::placeholder]:text-[var(--tone-text-a1a4b0)] [&:focus]:border-[var(--tone-border-9b8ee1)] [&:focus]:bg-[var(--tone-bg-ffffff)] max-[761px]:text-[16px]"
                                            value={pdfName}
                                            onChange={(event) => setPdfName(event.target.value)}
                                            maxLength={160}
                                        />
                                    </label>
                                    <label>
                                        Контакт для замовника{' '}
                                        <span className="optional-label text-[10px] text-[var(--tone-text-9295a4)] font-normal ml-[5px]">
                                            необов’язково
                                        </span>
                                        <input
                                            className="workspace-input block w-full border border-[var(--tone-border-e2e4ed)] rounded-[8px] bg-[var(--tone-bg-fcfcfe)] py-[11px] px-3 mt-2 text-ink text-[13px] font-normal outline-none [transition:border-color_.15s] [&::placeholder]:text-[var(--tone-text-a1a4b0)] [&:focus]:border-[var(--tone-border-9b8ee1)] [&:focus]:bg-[var(--tone-bg-ffffff)] max-[761px]:text-[16px]"
                                            value={pdfContact}
                                            onChange={(event) => setPdfContact(event.target.value)}
                                            maxLength={160}
                                            placeholder="Телефон, email або сайт"
                                        />
                                    </label>
                                    <label>
                                        Що включити в PDF
                                        <select
                                            className="workspace-input block w-full border border-[var(--tone-border-e2e4ed)] rounded-[8px] bg-[var(--tone-bg-fcfcfe)] py-[11px] px-3 mt-2 text-ink text-[13px] font-normal outline-none [transition:border-color_.15s] [&::placeholder]:text-[var(--tone-text-a1a4b0)] [&:focus]:border-[var(--tone-border-9b8ee1)] [&:focus]:bg-[var(--tone-bg-ffffff)] max-[761px]:text-[16px]"
                                            value={exportScope}
                                            onChange={(event) => setExportScope(event.target.value)}
                                        >
                                            <option value="visible">
                                                Поточна вибірка ({visible.length})
                                            </option>
                                            <option value="all">
                                                Увесь прайс ({services.length})
                                            </option>
                                        </select>
                                    </label>
                                    <Button
                                        variant="brand"
                                        disabled={
                                            exporting ||
                                            busy ||
                                            !(exportScope === 'all' ? services : visible).length
                                        }
                                        onClick={() => void exportPdf()}
                                    >
                                        {exporting ? (
                                            <LoaderCircle className="animate-spin" size={17} />
                                        ) : (
                                            <Download size={17} />
                                        )}
                                        {exporting ? 'Формуємо PDF…' : 'Завантажити PDF'}
                                    </Button>
                                </div>
                                <p className="category-help pt-0 px-6 pb-5 text-subtle text-[11px] leading-[1.7]">
                                    Ім’я та контакт використовуються лише для цього PDF. Зміна
                                    прайсу не змінює вже завантажені документи.
                                </p>
                            </section>
                        </>
                    )}
                </>
            )}
        </div>
    );
}
