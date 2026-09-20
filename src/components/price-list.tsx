'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Download, FolderPlus, Layers3, LoaderCircle, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { formatPrice, priceListError, selectServices, serviceUnits, validateService, type Service, type ServiceCategory, type ServiceSort, type ServiceUnit } from '@/lib/price-list';

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
            if (authError || auth.user?.id !== userId) throw new Error('Увійдіть повторно, щоб відкрити свій прайс-лист.');
            const [categoryResult, serviceResult] = await Promise.all([
                supabase.from('service_categories').select('*').eq('user_id', userId).order('name'),
                supabase.from('services').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
            ]);
            if (categoryResult.error) throw new Error(priceListError(categoryResult.error));
            if (serviceResult.error) throw new Error(priceListError(serviceResult.error));
            if (version !== loadVersion.current) return;
            setCategories(categoryResult.data as ServiceCategory[]);
            setServices(serviceResult.data as Service[]);
            setCategoryId((current) => categoryResult.data.some((category) => category.id === current) ? current : '');
        } catch (cause) {
            if (version === loadVersion.current) setLoadError(cause instanceof Error ? cause.message : priceListError({}));
        } finally {
            if (version === loadVersion.current) setLoading(false);
        }
    }, [userId]);

    useEffect(() => { void reload(); return () => { loadVersion.current++; }; }, [reload]);

    async function mutate(action: (client: NonNullable<ReturnType<typeof createSupabaseBrowserClient>>) => Promise<void>) {
        if (busyRef.current) return;
        busyRef.current = true;
        setBusy(true); setError(''); setNotice('');
        try {
            const client = createSupabaseBrowserClient();
            if (!client) throw new Error('Підключення недоступне. Оновіть сторінку.');
            const { data, error: authError } = await client.auth.getUser();
            if (authError || data.user?.id !== userId) throw new Error('Сесія завершилася або акаунт змінився. Увійдіть повторно.');
            await action(client);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : priceListError({}));
        } finally { busyRef.current = false; setBusy(false); }
    }

    function openService(service: Service | null = null) {
        setEditing(service); setShowForm(true); setError(''); setNotice('');
        if (!categories.length) setShowCategories(true);
    }

    async function saveCategory(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const name = categoryName.trim();
        if (!name || name.length > 80) { setError('Вкажіть назву категорії до 80 символів.'); return; }
        await mutate(async (client) => {
            const result = categoryEditing
                ? await client.from('service_categories').update({ name }).eq('id', categoryEditing.id).eq('user_id', userId).select('*').single()
                : await client.from('service_categories').insert({ name, user_id: userId }).select('*').single();
            if (result.error) throw new Error(priceListError(result.error));
            const category = result.data as ServiceCategory;
            setCategories((current) => [...current.filter((item) => item.id !== category.id), category].sort((a, b) => a.name.localeCompare(b.name, 'uk-UA')));
            setCategoryName(''); setCategoryEditing(null);
            setNotice(categoryEditing ? 'Категорію оновлено.' : 'Категорію додано. Тепер можна створити послугу.');
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
        if (validation) { setError(validation); return; }
        if (!categories.some((category) => category.id === chosenCategory)) { setError('Оберіть доступну категорію.'); return; }
        await mutate(async (client) => {
            const values = { name, price: Number(price), unit: unit as ServiceUnit, category_id: chosenCategory };
            const result = editing
                ? await client.from('services').update(values).eq('id', editing.id).eq('user_id', userId).select('*').single()
                : await client.from('services').insert({ ...values, user_id: userId }).select('*').single();
            if (result.error) throw new Error(priceListError(result.error));
            const service = result.data as Service;
            setServices((current) => [service, ...current.filter((item) => item.id !== service.id)]);
            setShowForm(false); setEditing(null); setCategoryId(''); setQuery('');
            setNotice(editing ? 'Послугу оновлено.' : 'Послугу додано до прайсу.');
        });
    }

    async function deleteService(service: Service) {
        if (!window.confirm(`Видалити послугу «${service.name}» з прайсу?`)) return;
        await mutate(async (client) => {
            const result = await client.from('services').delete().eq('id', service.id).eq('user_id', userId).select('id').single();
            if (result.error) throw new Error(priceListError(result.error));
            setServices((current) => current.filter((item) => item.id !== service.id));
            if (editing?.id === service.id) { setEditing(null); setShowForm(false); }
            setNotice('Послугу видалено.');
        });
    }

    async function deleteCategory(category: ServiceCategory) {
        if (!window.confirm(`Видалити порожню категорію «${category.name}»?`)) return;
        await mutate(async (client) => {
            const result = await client.from('service_categories').delete().eq('id', category.id).eq('user_id', userId).select('id').single();
            if (result.error) throw new Error(priceListError(result.error));
            setCategories((current) => current.filter((item) => item.id !== category.id));
            if (categoryId === category.id) setCategoryId('');
            if (categoryEditing?.id === category.id) { setCategoryEditing(null); setCategoryName(''); }
            setNotice('Категорію видалено.');
        });
    }

    async function exportPdf() {
        if (exportRef.current) return;
        const rows = exportScope === 'all' ? selectServices(services, categories, '', '', 'category') : visible;
        if (!rows.length) return;
        exportRef.current = true; setExporting(true); setError('');
        try {
            const { downloadPriceListPdf } = await import('@/lib/price-list-pdf');
            await downloadPriceListPdf({ services: rows, categories, author: pdfName.trim() || userName, contact: pdfContact.trim() });
            setNotice('PDF-прайс сформовано. Файл можна надіслати замовнику.');
        } catch { setError('Не вдалося сформувати PDF. Перевірте з’єднання та спробуйте ще раз.'); }
        finally { exportRef.current = false; setExporting(false); }
    }

    return <div className="price-list">
        <div className="price-actions"><p>Ваші навички. Ваші ціни.</p><div><Button variant="outline" onClick={() => setShowCategories((current) => !current)} disabled={loading || !!loadError || busy}><FolderPlus size={17} />Категорії</Button><Button className="workspace-primary" onClick={() => openService()} disabled={loading || !!loadError || busy}><Plus size={17} />Додати послугу</Button></div></div>
        {notice && <p role="status" className="workspace-notice">{notice}</p>}
        {error && <p role="alert" className="workspace-error">{error}</p>}
        {loading ? <p role="status" className="price-loading"><LoaderCircle className="animate-spin" size={20} />Завантажуємо ваш прайс…</p> : loadError ? <div role="alert" className="workspace-error"><p>{loadError}</p><Button variant="outline" className="mt-3" onClick={() => void reload()}>Спробувати знову</Button></div> : <>
            {showCategories && <section className="workspace-panel">
                <div className="panel-heading"><div><h2>Ваші категорії</h2><p>Створіть власні напрями: плитка, дерево, сантехніка або будь-які інші.</p></div><button className="icon-button" aria-label="Закрити категорії" onClick={() => setShowCategories(false)}><X size={19} /></button></div>
                <form onSubmit={saveCategory} className="category-form"><label>{categoryEditing ? 'Нова назва категорії' : 'Назва нової категорії'}<input className="workspace-input" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Наприклад, сантехніка" required maxLength={80} disabled={busy} /></label><Button type="submit" className="workspace-primary" disabled={busy}>{categoryEditing ? 'Зберегти' : 'Додати категорію'}</Button>{categoryEditing && <Button type="button" variant="ghost" disabled={busy} onClick={() => { setCategoryEditing(null); setCategoryName(''); }}>Скасувати</Button>}</form>
                <div className="category-manager">{categories.map((category) => {
                    const count = services.filter((service) => service.category_id === category.id).length;
                    return <div key={category.id}><span>{category.name}<small>{count} послуг</small></span><button className="icon-button" disabled={busy} aria-label={`Перейменувати ${category.name}`} onClick={() => { setCategoryEditing(category); setCategoryName(category.name); }}><Pencil size={15} /></button><button className="icon-button" disabled={busy || count > 0} title={count ? 'Спочатку перенесіть або видаліть послуги цієї категорії' : 'Видалити категорію'} aria-label={`Видалити категорію ${category.name}`} onClick={() => void deleteCategory(category)}><Trash2 size={15} /></button></div>;
                })}</div>
                <p className="category-help">Категорію з послугами можна видалити після перенесення або видалення її послуг.</p>
            </section>}
            {showForm && <section className="workspace-panel project-form-panel">
                <div className="panel-heading"><div><h2>{editing ? 'Редагувати послугу' : 'Нова послуга'}</h2><p>Вартість за одну обрану одиницю. Валюта — гривня.</p></div><button className="icon-button" disabled={busy} aria-label="Закрити форму послуги" onClick={() => setShowForm(false)}><X size={19} /></button></div>
                {!categories.length ? <p className="category-help">Спочатку додайте хоча б одну категорію у блоці вище.</p> : <form key={editing?.id ?? 'new'} onSubmit={saveService}>
                    <fieldset disabled={busy} className="project-form-fields">
                        <label>Назва послуги<input autoFocus name="name" className="workspace-input" required maxLength={160} defaultValue={editing?.name ?? ''} placeholder="Наприклад, укладання плитки" /></label>
                        <label>Категорія<select name="category_id" className="workspace-input" required defaultValue={editing?.category_id ?? (categoryId || categories[0]?.id)}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
                        <label>Ціна за одиницю, ₴<input name="price" className="workspace-input" type="number" inputMode="decimal" min="0" max="9999999999.99" step="0.01" required defaultValue={editing?.price ?? ''} placeholder="0,00" /></label>
                        <label>Одиниця виміру<select name="unit" className="workspace-input" defaultValue={editing?.unit ?? 'm2'}>{Object.entries(serviceUnits).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                    </fieldset>
                    <div className="form-actions"><Button type="button" variant="ghost" disabled={busy} onClick={() => setShowForm(false)}>Скасувати</Button><Button type="submit" className="workspace-primary" disabled={busy}>{busy ? 'Зберігаємо…' : editing ? 'Зберегти зміни' : 'Додати до прайсу'}</Button></div>
                </form>}
            </section>}
            {services.length === 0 ? <section className="workspace-panel empty-projects"><div className="empty-art"><Layers3 size={35} strokeWidth={1.3} /></div><span className="eyebrow">ВАША РОБОТА МАЄ ЦІНУ</span><h2>Створіть свій прайс-лист</h2><p>Додайте категорії та послуги. Готовий прайс можна завантажити в PDF для замовника.</p><Button className="workspace-primary" onClick={() => categories.length ? openService() : setShowCategories(true)}><Plus size={17} />{categories.length ? 'Додати першу послугу' : 'Створити першу категорію'}</Button></section> : <>
                <section className="workspace-panel">
                    <div className="panel-heading"><div><h2>Послуги та ціни <span className="count-badge">{services.length}</span></h2><p>Оберіть напрям або знайдіть потрібну послугу.</p></div><Button variant="ghost" size="sm" disabled={busy} onClick={() => { setShowForm(false); void reload(); }}>Оновити</Button></div>
                    <div className="price-filters"><label className="project-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Знайти послугу…" aria-label="Пошук послуг" /></label><select aria-label="Категорія послуг" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Усі категорії</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><select aria-label="Сортування послуг" value={sort} onChange={(event) => setSort(event.target.value as ServiceSort)}><option value="category">За категоріями</option><option value="name">За назвою</option><option value="price-asc">Ціна: від нижчої</option><option value="price-desc">Ціна: від вищої</option></select></div>
                    <div className="price-table-wrap"><table className="price-table"><thead><tr><th>Послуга</th><th>Категорія</th><th>Одиниця</th><th>Ціна</th><th><span className="sr-only">Дії</span></th></tr></thead><tbody>{visible.map((service) => <tr key={service.id}><td>{service.name}</td><td><span className="price-category-label">{categoryNames.get(service.category_id) ?? 'Без категорії'}</span></td><td>{serviceUnits[service.unit]}</td><td>{formatPrice(service.price)}</td><td><div className="price-row-actions"><button className="icon-button" disabled={busy} onClick={() => openService(service)} aria-label={`Редагувати ${service.name}`}><Pencil size={15} /></button><button className="icon-button" disabled={busy} onClick={() => void deleteService(service)} aria-label={`Видалити ${service.name}`}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div>
                    {!visible.length && <div className="search-empty"><h3>Послуг не знайдено</h3><p>Змініть категорію або пошуковий запит.</p><Button variant="ghost" onClick={() => { setCategoryId(''); setQuery(''); }}>Скинути фільтри</Button></div>}
                    <div className="list-footer">Показано {visible.length} із {services.length} · ціни за одиницю</div>
                </section>
                <section className="workspace-panel pdf-panel"><div className="panel-heading"><div><h2><Download size={18} />Прайс для замовника</h2><p>Завантажте PDF з назвами, категоріями, одиницями та цінами.</p></div></div><div className="pdf-options"><label>Ім’я майстра або компанія<input className="workspace-input" value={pdfName} onChange={(event) => setPdfName(event.target.value)} maxLength={160} /></label><label>Контакт для замовника <span className="optional-label">необов’язково</span><input className="workspace-input" value={pdfContact} onChange={(event) => setPdfContact(event.target.value)} maxLength={160} placeholder="Телефон, email або сайт" /></label><label>Що включити в PDF<select className="workspace-input" value={exportScope} onChange={(event) => setExportScope(event.target.value)}><option value="visible">Поточна вибірка ({visible.length})</option><option value="all">Увесь прайс ({services.length})</option></select></label><Button className="workspace-primary" disabled={exporting || busy || !(exportScope === 'all' ? services : visible).length} onClick={() => void exportPdf()}>{exporting ? <LoaderCircle className="animate-spin" size={17} /> : <Download size={17} />}{exporting ? 'Формуємо PDF…' : 'Завантажити PDF'}</Button></div><p className="category-help">Ім’я та контакт використовуються лише для цього PDF. Зміна прайсу не змінює вже завантажені документи.</p></section>
            </>}
        </>}
    </div>;
}
