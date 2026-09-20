'use client';

import { useRef, useState, type FormEvent } from 'react';
import { BriefcaseBusiness, Camera, CircleDollarSign, ClipboardList, Hammer, Home, LogOut, Plus, Sparkles, ArrowUpRight, ChevronRight, Search, X, FolderOpen, UserRound, Wallet, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PriceList } from '@/components/price-list';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { projectError, projectStatuses, type Project } from '@/lib/projects';

const navigation = [
    { label: 'Огляд', icon: Home },
    { label: 'Проекти', icon: ClipboardList },
    { label: 'Послуги та ціни', icon: Hammer },
    { label: 'Портфоліо', icon: Camera },
];
// Keep SSR and browser output identical across different ICU/CLDR versions.
const money = (amount: number) => {
    const [whole, fraction] = amount.toFixed(2).split('.');
    return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')},${fraction}\u00a0₴`;
};
const fieldClass = 'workspace-input';

export function Dashboard({ userName, userId, initialProjects, loadError }: {
    userName: string;
    userId: string;
    initialProjects: Project[];
    loadError: string | null;
}) {
    const [activeSection, setActiveSection] = useState('Огляд');
    const [projects, setProjects] = useState(initialProjects);
    const [selectedId, setSelectedId] = useState(initialProjects[0]?.id);
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('Усі');
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const savingRef = useRef(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const selected = projects.find((project) => project.id === selectedId);
    const openForm = () => { setError(''); setNotice(''); setShowForm(true); };
    const visibleProjects = projects.filter((project) => (filter === 'Усі' || project.status === filter) && `${project.name} ${project.client}`.toLocaleLowerCase('uk-UA').includes(query.toLocaleLowerCase('uk-UA')));
    const paymentPercent = selected && Number(selected.total) > 0 ? Math.round(Number(selected.paid) / Number(selected.total) * 100) : 0;
    const isProjects = activeSection === 'Огляд' || activeSection === 'Проекти';

    async function createProject(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (savingRef.current) return;
        const fields = new FormData(event.currentTarget);
        const name = String(fields.get('name') ?? '').trim();
        const client = String(fields.get('client') ?? '').trim();
        const total = Number(fields.get('total') || 0);
        const paid = Number(fields.get('paid') || 0);
        const status = String(fields.get('status')) as Project['status'];
        if (!name || name.length > 160 || client.length > 160) {
            setError('Вкажіть назву проєкту. Назва та ім’я клієнта — до 160 символів.');
            return;
        }
        if (!Number.isFinite(total) || !Number.isFinite(paid) || total < 0 || paid < 0 || paid > total || total > 9999999999.99 || !projectStatuses.includes(status)) {
            setError('Перевірте суми: оплата не може перевищувати загальну вартість.');
            return;
        }
        savingRef.current = true;
        setSaving(true);
        setError('');
        try {
            const supabase = createSupabaseBrowserClient();
            if (!supabase) { setError('Підключення недоступне. Оновіть сторінку.'); return; }
            const { data: auth, error: authError } = await supabase.auth.getUser();
            if (authError || !auth.user || auth.user.id !== userId) {
                setError('Сесія завершилася або акаунт змінився. Оновіть сторінку та увійдіть повторно.');
                return;
            }
            const { data, error: insertError } = await supabase.from('projects')
                .insert({ user_id: auth.user.id, name, client, status, total, paid }).select('*').single();
            if (insertError) { setError(projectError(insertError)); return; }
            if (!data) { setError('Не вдалося підтвердити збереження. Оновіть сторінку перед повторною спробою.'); return; }
            const project = data as Project;
            setProjects((current) => [project, ...current]);
            setSelectedId(project.id);
            setQuery('');
            setFilter('Усі');
            setShowForm(false);
            setActiveSection('Проекти');
            setNotice('Проєкт збережено.');
        } catch {
            setError('Не вдалося підтвердити збереження. Перевірте з’єднання й оновіть сторінку перед повторною спробою.');
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    }

    async function signOut() {
        try {
            const supabase = createSupabaseBrowserClient();
            if (supabase) {
                const { error } = await supabase.auth.signOut();
                if (error) { setNotice('Не вдалося вийти. Спробуйте ще раз.'); return; }
            }
            window.location.href = '/login';
        } catch { setNotice('Не вдалося вийти. Перевірте з’єднання.'); }
    }


    return (
        <div className="workspace">
            <aside className="workspace-sidebar">
                <a className="workspace-brand" href="/" aria-label="Мій кошторис — головна">
                    <span className="brand-mark"><Sparkles size={20} strokeWidth={1.8} /></span>
                    <span>Мій кошторис<span className="brand-caption">Простір майстра</span></span>
                </a>
                <p className="nav-caption">РОБОЧИЙ ПРОСТІР</p>
                <nav className="workspace-navigation" aria-label="Основна навігація">
                    {navigation.map(({ label, icon: Icon }) => (
                        <button key={label} onClick={() => setActiveSection(label)} aria-current={activeSection === label ? 'page' : undefined}>
                            <Icon size={19} strokeWidth={1.7} />{label}
                            {label === 'Проекти' && !loadError && <span className="nav-count">{projects.length}</span>}
                        </button>
                    ))}
                </nav>
                <div className="sidebar-note"><span className="sidebar-note-icon"><FolderOpen size={20} /></span><h3>Від задуму до результату.</h3><p>Ваші проєкти й фінанси — в одному просторі.</p></div>
                <div className="sidebar-profile"><span className="user-avatar">{userName.slice(0, 1).toUpperCase()}</span><span className="profile-name">{userName}<small>Особистий акаунт</small></span><button onClick={signOut} aria-label="Вийти з акаунта" className="icon-button"><LogOut size={17} /></button></div>
            </aside>
            <main className="workspace-main">
                <header className="workspace-topbar">
                    <div className="breadcrumbs"><span className="desktop-breadcrumb">Робочий простір</span><ChevronRight size={14} className="desktop-breadcrumb" /><span>{activeSection}</span></div>
                    <div className="topbar-account"><span className="private-label"><span />Особистий простір</span><button onClick={signOut} className="user-avatar" aria-label="Вийти з акаунта" title="Вийти з акаунта">{userName.slice(0, 1).toUpperCase()}</button></div>
                </header>
                <div className="workspace-content">
                    <div className="workspace-page-heading">
                        <div><p className="eyebrow">УСЕ ПІД КОНТРОЛЕМ</p><h1>{activeSection === 'Огляд' ? `Вітаємо, ${userName.split(' ')[0]}` : activeSection}</h1><p className="page-description">{isProjects ? 'Ваші проєкти, оплати та наступні кроки.' : activeSection === 'Послуги та ціни' ? 'Власний прайс для вашої майстерності.' : 'Більше можливостей для вашої роботи.'}</p></div>
                        {isProjects && <Button onClick={openForm} disabled={!!loadError} className="workspace-primary"><Plus size={18} />Новий проєкт</Button>}
                    </div>
                    {isProjects && notice && <p role="status" className="workspace-notice">{notice}</p>}
                    {isProjects && loadError && <div role="alert" className="workspace-error"><p>{loadError}</p><Button onClick={() => window.location.reload()} variant="outline" className="mt-3">Спробувати знову</Button></div>}
                    {isProjects && showForm && (
                        <section aria-labelledby="new-project-heading" className="workspace-panel project-form-panel">
                            <div className="panel-heading"><div><span className="eyebrow">НОВИЙ ПОЧАТОК</span><h2 id="new-project-heading">Створимо ваш проєкт</h2><p>Додайте основне. Клієнта можна вказати за бажанням.</p></div><button className="icon-button" disabled={saving} aria-label="Закрити форму" onClick={() => setShowForm(false)}><X size={20} /></button></div>
                            <form onSubmit={createProject}>
                                <fieldset disabled={saving} className="project-form-fields">
                                    <label>Назва проєкту<input autoFocus name="name" placeholder="Наприклад, ремонт квартири" required maxLength={160} className={fieldClass} /></label>
                                    <label>Клієнт <span className="optional-label">необов’язково</span><input name="client" placeholder="Ім’я або назва компанії" maxLength={160} className={fieldClass} /></label>
                                    <label>Загальна сума, ₴<input name="total" type="number" min="0" max="9999999999.99" step="0.01" defaultValue="0" required className={fieldClass} /></label>
                                    <label>Вже оплачено, ₴<input name="paid" type="number" min="0" max="9999999999.99" step="0.01" defaultValue="0" required className={fieldClass} /></label>
                                    <label>Статус<select name="status" className={fieldClass}>{projectStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
                                </fieldset>
                                {error && <p role="alert" className="workspace-error">{error}</p>}
                                <div className="form-actions"><Button type="button" variant="ghost" disabled={saving} onClick={() => setShowForm(false)}>Скасувати</Button><Button type="submit" disabled={saving} className="workspace-primary">{saving ? 'Зберігаємо…' : 'Створити проєкт'}<ArrowUpRight size={17} /></Button></div>
                            </form>
                        </section>
                    )}
                    {isProjects && !loadError && <>
                        <section className="workspace-stats" aria-label="Статистика проєктів">
                            {[
                                { label: 'Активні проєкти', value: projects.filter((p) => p.status !== 'Завершено').length, tone: 'indigo', note: 'Заплановані та в роботі', icon: BriefcaseBusiness },
                                { label: 'Зараз у роботі', value: projects.filter((p) => p.status === 'В роботі').length, tone: 'amber', note: 'Рухаємося до результату', icon: Hammer },
                                { label: 'До отримання', value: money(projects.reduce((sum, p) => sum + Math.round((Number(p.total) - Number(p.paid)) * 100), 0) / 100), tone: 'mint', note: 'Залишок оплат за проєктами', icon: Wallet },
                            ].map(({ label, value, tone, note, icon: Icon }) => <div key={label} className="stat-card"><div className="stat-top"><span>{label}</span><span className={`stat-icon ${tone}`}><Icon size={19} strokeWidth={1.7} /></span></div><p className="stat-value">{value}</p><p className="stat-note">{note}</p></div>)}
                        </section>
                        {projects.length === 0 ? (
                            <section className="workspace-panel empty-projects"><div className="empty-art" aria-hidden="true"><span /><FolderOpen size={35} strokeWidth={1.3} /><i><Plus size={16} /></i></div><span className="eyebrow">МІСЦЕ ДЛЯ ВАШИХ ІДЕЙ</span><h2>Перший проєкт починається тут</h2><p>Додайте назву, клієнта й вартість робіт.<br />Ми допоможемо тримати фінанси в порядку.</p><Button onClick={openForm} className="workspace-primary"><Plus size={17} />Створити перший проєкт</Button></section>
                        ) : (
                            <section className="projects-layout">
                                <div className="workspace-panel project-list-panel">
                                    <div className="panel-heading"><div><h2>Ваші проєкти <span className="count-badge">{projects.length}</span></h2><p>Від маленьких завдань до великих змін.</p></div></div>
                                    <div className="project-toolbar"><label className="project-search"><Search size={17} /><input aria-label="Пошук проєкту або клієнта" placeholder="Знайти проєкт або клієнта…" value={query} onChange={(event) => setQuery(event.target.value)} /></label><select aria-label="Фільтр за статусом" value={filter} onChange={(event) => setFilter(event.target.value)}><option>Усі</option>{projectStatuses.map((status) => <option key={status}>{status}</option>)}</select></div>
                                    <div className="project-list">
                                        {visibleProjects.map((project) => <button key={project.id} onClick={() => setSelectedId(project.id)} aria-pressed={selectedId === project.id} className="project-row"><span className="project-row-icon"><FolderOpen size={21} strokeWidth={1.6} /></span><span className="project-row-info"><span className="project-row-name">{project.name}</span><span className="project-row-client">{project.client || 'Клієнт не вказаний'}</span><span className={`status-pill ${project.status === 'В роботі' ? 'status-active' : project.status === 'Завершено' ? 'status-done' : 'status-waiting'}`}><span />{project.status}</span></span><span className="project-row-amount">{money(Number(project.total))}<ChevronRight size={16} /></span></button>)}
                                        {visibleProjects.length === 0 && <div className="search-empty"><Search size={25} /><h3>Нічого не знайдено</h3><p>Спробуйте іншу назву або змініть статус.</p><Button variant="ghost" onClick={() => { setQuery(''); setFilter('Усі'); }}>Скинути фільтри</Button></div>}
                                    </div>
                                    <div className="list-footer">Показано {visibleProjects.length} із {projects.length}</div>
                                </div>
                                {selected && <aside className="project-details" aria-label="Деталі обраного проєкту"><div className="detail-top"><span>ДЕТАЛІ ПРОЄКТУ</span><ArrowUpRight size={18} /></div><div className="detail-folder"><FolderOpen size={26} strokeWidth={1.5} /></div><h2>{selected.name}</h2><p className="detail-client"><UserRound size={14} />{selected.client || 'Клієнт не вказаний'}</p><span className="detail-status">{selected.status === 'Завершено' && <Check size={13} />}{selected.status}</span><div className="detail-total"><span>Вартість проєкту</span><p>{money(Number(selected.total))}</p></div><div className="payment-heading"><span>Оплачено</span><span>{paymentPercent}%</span></div><div className="payment-track" role="progressbar" aria-label="Частка оплаченої суми" aria-valuemin={0} aria-valuemax={100} aria-valuenow={paymentPercent}><span style={{ width: `${paymentPercent}%` }} /></div><dl className="detail-amounts"><div><dt>Вже отримано</dt><dd>{money(Number(selected.paid))}</dd></div><div><dt>Залишилось</dt><dd>{money((Math.round(Number(selected.total) * 100) - Math.round(Number(selected.paid) * 100)) / 100)}</dd></div></dl><div className="detail-footnote"><CircleDollarSign size={16} /><span>Усі суми в українській гривні</span></div></aside>}
                            </section>
                        )}
                    </>}
                    {activeSection === 'Послуги та ціни' && <PriceList userId={userId} userName={userName} />}
                    {activeSection === 'Портфоліо' && <section className="workspace-panel empty-projects"><div className="empty-art" aria-hidden="true"><Camera size={35} strokeWidth={1.3} /></div><span className="eyebrow">НЕЗАБАРОМ У ВАШОМУ ПРОСТОРІ</span><h2>Роботи, якими ви пишаєтесь</h2><p>Портфоліо ще готується. Зараз можна вести проєкти та їхні фінанси.</p><Button variant="outline" onClick={() => setActiveSection('Проекти')}>До моїх проєктів<ArrowUpRight size={17} /></Button></section>}
                    <footer className="workspace-footer"><span>Мій кошторис</span><span>Менше рутини. Більше зробленого.</span></footer>
                </div>
            </main>
            <nav aria-label="Мобільна навігація" className="workspace-mobile-nav">{navigation.map(({ label, icon: Icon }) => <button key={label} onClick={() => setActiveSection(label)} aria-current={activeSection === label ? 'page' : undefined}><Icon size={20} strokeWidth={1.7} />{label}</button>)}</nav>
        </div>
    );
}
