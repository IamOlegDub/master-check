'use client';

import { useCallback, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { AccountMenu, Avatar } from '@/components/account-menu';
import { ProfileSettings } from '@/components/profile-settings';
import { profileName, type Profile } from '@/lib/profile';
import {
    BriefcaseBusiness,
    Camera,
    CircleDollarSign,
    ClipboardList,
    Hammer,
    Home,
    LogOut,
    Plus,
    Sparkles,
    ArrowUpRight,
    ChevronRight,
    Search,
    X,
    FolderOpen,
    UserRound,
    Wallet,
    Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PriceList } from '@/components/price-list';
import { ProjectEstimate } from '@/components/project-estimate';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { projectError, projectStatuses, type Project } from '@/lib/projects';

const navigation = [
    { id: 'overview', label: 'Огляд', icon: Home },
    { id: 'projects', label: 'Проекти', icon: ClipboardList },
    { id: 'services', label: 'Послуги та ціни', icon: Hammer },
    { id: 'portfolio', label: 'Портфоліо', icon: Camera },
];
// Keep SSR and browser output identical across different ICU/CLDR versions.
const money = (amount: number) => {
    const [whole, fraction] = amount.toFixed(2).split('.');
    return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')},${fraction}\u00a0₴`;
};
const fieldClass =
    'workspace-input block w-full border border-[#e2e4ed] rounded-[8px] bg-[#fcfcfe] py-[11px] px-3 mt-2 text-ink text-[13px] font-normal outline-none [transition:border-color_.15s] [&::placeholder]:text-[#a1a4b0] [&:focus]:border-[#9b8ee1] [&:focus]:bg-[#fff] max-[761px]:text-[16px]';

export function Dashboard({
    userName: initialName,
    userId,
    initialProjects,
    loadError,
    initialProfile,
    settingsPage = false,
}: {
    userName: string;
    userId: string;
    initialProjects: Project[];
    loadError: string | null;
    initialProfile?: Profile;
    settingsPage?: boolean;
}) {
    const [profile, setProfile] = useState(initialProfile);
    const userName = profile ? profileName(profile) : initialName;
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const activeSection = settingsPage
        ? 'Налаштування'
        : (navigation.find((item) => item.id === searchParams.get('section'))?.label ?? 'Огляд');
    function sectionHref(label: string) {
        const params = new URLSearchParams(searchParams.toString());
        const id = navigation.find((item) => item.label === label)?.id ?? 'overview';
        if (id === 'overview') params.delete('section');
        else params.set('section', id);
        return `${settingsPage ? '/' : pathname}${params.size ? `?${params}` : ''}`;
    }
    function navigateSection(label: string) {
        if (settingsPage) {
            router.push(sectionHref(label));
            return;
        }
        if (label !== activeSection) window.history.pushState(null, '', sectionHref(label));
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
    function followSection(event: MouseEvent<HTMLAnchorElement>, label: string) {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
            return;
        event.preventDefault();
        navigateSection(label);
    }
    const [projects, setProjects] = useState(initialProjects);
    const updateProject = useCallback(
        (project: Project) =>
            setProjects((current) =>
                current.map((item) => (item.id === project.id ? project : item)),
            ),
        [],
    );
    const [selectedId, setSelectedId] = useState(initialProjects[0]?.id);
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('Усі');
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const savingRef = useRef(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const selected = projects.find((project) => project.id === selectedId);
    const openForm = () => {
        setError('');
        setNotice('');
        setShowForm(true);
    };
    const visibleProjects = projects.filter(
        (project) =>
            (filter === 'Усі' || project.status === filter) &&
            `${project.name} ${project.client}`
                .toLocaleLowerCase('uk-UA')
                .includes(query.toLocaleLowerCase('uk-UA')),
    );
    const paymentPercent =
        selected && Number(selected.total) > 0
            ? Math.min(100, Math.round((Number(selected.paid) / Number(selected.total)) * 100))
            : 0;
    const isProjects = activeSection === 'Огляд' || activeSection === 'Проекти';

    async function createProject(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (savingRef.current) return;
        const fields = new FormData(event.currentTarget);
        const name = String(fields.get('name') ?? '').trim();
        const client = String(fields.get('client') ?? '').trim();
        const status = String(fields.get('status')) as Project['status'];
        if (!name || name.length > 160 || client.length > 160) {
            setError('Вкажіть назву проєкту. Назва та ім’я клієнта — до 160 символів.');
            return;
        }
        if (!projectStatuses.includes(status)) {
            setError('Оберіть статус проєкту.');
            return;
        }
        savingRef.current = true;
        setSaving(true);
        setError('');
        try {
            const supabase = createSupabaseBrowserClient();
            if (!supabase) {
                setError('Підключення недоступне. Оновіть сторінку.');
                return;
            }
            const { data: auth, error: authError } = await supabase.auth.getUser();
            if (authError || !auth.user || auth.user.id !== userId) {
                setError(
                    'Сесія завершилася або акаунт змінився. Оновіть сторінку та увійдіть повторно.',
                );
                return;
            }
            const { data, error: insertError } = await supabase
                .from('projects')
                .insert({ user_id: auth.user.id, name, client, status })
                .select('*')
                .single();
            if (insertError) {
                setError(projectError(insertError));
                return;
            }
            if (!data) {
                setError(
                    'Не вдалося підтвердити збереження. Оновіть сторінку перед повторною спробою.',
                );
                return;
            }
            const project = data as Project;
            setProjects((current) => [project, ...current]);
            setSelectedId(project.id);
            setQuery('');
            setFilter('Усі');
            setShowForm(false);
            navigateSection('Проекти');
            setNotice('Проєкт збережено.');
        } catch {
            setError(
                'Не вдалося підтвердити збереження. Перевірте з’єднання й оновіть сторінку перед повторною спробою.',
            );
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
                if (error) {
                    setNotice('Не вдалося вийти. Спробуйте ще раз.');
                    return;
                }
            }
            window.location.href = '/login';
        } catch {
            setNotice('Не вдалося вийти. Перевірте з’єднання.');
        }
    }

    return (
        <div className="workspace text-ink bg-[#f7f8fb] min-h-dvh text-[14px] tracking-[-.015em] [&_button]:cursor-pointer [&_button:disabled]:cursor-not-allowed [&_:is(button,_a,_input,_select):focus-visible]:[outline:3px_solid_#a59ced] [&_:is(button,_a,_input,_select):focus-visible]:[outline-offset:3px] motion-reduce:[&_*]:transition-none! motion-reduce:[&_*]:animate-none!">
            <aside className="workspace-sidebar w-62 fixed [inset:0_auto_0_0] flex flex-col pt-8 px-5 pb-4.5 bg-[#fff] border-r border-line z-[30] max-[1200px]:w-54.5 max-[1200px]:px-4 max-[1024px]:hidden">
                <a
                    className="workspace-brand flex items-center gap-[11px] text-ink font-[650] text-[15px] no-underline"
                    href="/"
                    aria-label="Мій кошторис — головна"
                >
                    <span className="brand-mark inline-flex items-center justify-center w-[39px] h-[39px] rounded-[12px] bg-brand text-[#fff] shadow-[0_4px_10px_#6155db20] shrink-0">
                        <Sparkles size={20} strokeWidth={1.8} />
                    </span>
                    <span>
                        Мій кошторис
                        <span className="brand-caption block text-subtle font-normal text-[11px] mt-[3px]">
                            Простір майстра
                        </span>
                    </span>
                </a>
                <p className="nav-caption mt-12 mx-3 mb-3.5 text-[9px] font-semibold tracking-[.11em] text-[#8b8fa0]">
                    РОБОЧИЙ ПРОСТІР
                </p>
                <nav
                    className="workspace-navigation grid gap-[5px] [&_a]:flex [&_a]:items-center [&_a]:gap-3 [&_a]:p-3 [&_a]:rounded-[9px] [&_a]:text-[#6e7384] [&_a]:text-left [&_a]:text-[13px] [&_a]:font-medium [&_a]:[transition:background_.15s,_color_.15s] [&_a:hover]:bg-[#f6f6fb] [&_a:hover]:text-ink [&_a[aria-current]]:bg-[#efedfc] [&_a[aria-current]]:text-[#6155cf] [&_a:focus-visible]:[outline:2px_solid_var(--brand)] [&_a:focus-visible]:[outline-offset:2px] [&_a:focus-visible]:rounded-[8px]"
                    aria-label="Основна навігація"
                >
                    {navigation.map(({ label, icon: Icon }) => (
                        <a
                            key={label}
                            href={sectionHref(label)}
                            onClick={(event) => followSection(event, label)}
                            aria-current={activeSection === label ? 'page' : undefined}
                        >
                            <Icon size={19} strokeWidth={1.7} />
                            {label}
                            {label === 'Проекти' && !loadError && (
                                <span className="nav-count ml-auto py-[1px] px-[7px] rounded-[5px] bg-[#f0f0f6] text-[#75728b] text-[11px]">
                                    {projects.length}
                                </span>
                            )}
                        </a>
                    ))}
                </nav>
                <div className="sidebar-note mt-auto pt-5.5 px-3 pb-7 [&_h3]:text-[12px] [&_h3]:font-[550] [&_h3]:mt-3 [&_h3]:mx-0 [&_h3]:mb-1.5 [&_p]:text-subtle [&_p]:text-[11px] [&_p]:leading-[1.8] [&_p]:max-w-[165px]">
                    <span className="sidebar-note-icon text-[#9086da]">
                        <FolderOpen size={20} />
                    </span>
                    <h3>Від задуму до результату.</h3>
                    <p>Ваші проєкти й фінанси — в одному просторі.</p>
                </div>
                <div className="sidebar-profile flex items-center gap-2.5 pt-4.5 px-0 pb-0 border-t border-line">
                    <a href="/settings" aria-label="Налаштування профілю">
                        <Avatar name={userName} url={profile?.avatarUrl} />
                    </a>
                    <span className="profile-name min-w-0 flex-1 text-[11px] wrap-anywhere font-[550] [&_small]:block [&_small]:mt-[3px] [&_small]:font-normal [&_small]:text-subtle [&_small]:text-[10px]">
                        {userName}
                        <small>Особистий акаунт</small>
                    </span>
                    <button
                        onClick={signOut}
                        aria-label="Вийти з акаунта"
                        className="icon-button inline-flex items-center justify-center w-8 h-8 rounded-[8px] text-subtle shrink-0 [&:hover]:bg-[#f1f1f8]"
                    >
                        <LogOut size={17} />
                    </button>
                </div>
            </aside>
            <main className="workspace-main ml-62 max-[1200px]:ml-54.5 max-[1024px]:ml-0 max-[1024px]:pb-[calc(96px_+_env(safe-area-inset-bottom))]">
                <header className="workspace-topbar h-19 py-0 px-10 flex items-center justify-between border-b border-line bg-[#ffffffa8] max-[1200px]:px-[25px] max-[761px]:h-15.5 max-[761px]:py-0 max-[761px]:px-5">
                    <nav
                        className="breadcrumbs flex items-center gap-3.5 text-[12px] [&_ol]:flex [&_ol]:items-center [&_ol]:gap-2 [&_li]:flex [&_li]:items-center [&_li]:gap-2 [&_a]:flex [&_a]:items-center [&_a]:gap-2 [&_ol]:list-none [&_ol]:m-0 [&_ol]:p-0 [&_ol]:flex-wrap [&_a]:min-h-11 [&_a]:text-subtle [&_a]:no-underline [&_a:hover]:text-brand [&_[aria-current=page]]:text-ink [&_a:focus-visible]:[outline:2px_solid_var(--brand)] [&_a:focus-visible]:[outline-offset:2px] [&_a:focus-visible]:rounded-[8px]"
                        aria-label="Шлях навігації"
                    >
                        <ol>
                            <li>
                                <a
                                    href={sectionHref('Огляд')}
                                    onClick={(event) => followSection(event, 'Огляд')}
                                    aria-current={activeSection === 'Огляд' ? 'page' : undefined}
                                >
                                    <Home size={16} aria-hidden="true" />
                                    <span>Огляд</span>
                                </a>
                            </li>
                            {activeSection !== 'Огляд' && (
                                <li>
                                    <ChevronRight size={14} aria-hidden="true" />
                                    <span aria-current="page">{activeSection}</span>
                                </li>
                            )}
                        </ol>
                    </nav>
                    <div className="topbar-account flex items-center gap-3.5 text-[12px]">
                        <span className="private-label inline-flex items-center gap-[7px] text-[11px] text-subtle [&_>_span]:w-[5px] [&_>_span]:h-[5px] [&_>_span]:bg-[#6bba93] [&_>_span]:rounded-full max-[761px]:hidden">
                            <span />
                            Особистий простір
                        </span>
                        <AccountMenu
                            name={userName}
                            avatarUrl={profile?.avatarUrl}
                            onSignOut={signOut}
                        />
                    </div>
                </header>
                <div
                    className={`workspace-content max-w-360 m-auto pt-[39px] px-10 pb-5.5 grid gap-6.5 max-[1200px]:px-[25px] max-[761px]:pt-[27px] max-[761px]:px-4.5 max-[761px]:pb-5 max-[761px]:gap-5 ${settingsPage ? 'max-[760px]:pt-0!' : ''}`}
                >
                    {settingsPage && profile && (
                        <ProfileSettings profile={profile} userId={userId} onSaved={setProfile} />
                    )}
                    {!settingsPage && (
                        <div className="workspace-page-heading flex items-center justify-between flex-wrap gap-5 mb-[5px] [&_h1]:text-[clamp(25px,_2.4vw,_34px)] [&_h1]:leading-[1.25] [&_h1]:font-semibold [&_h1]:tracking-[-.045em] [&_h1]:my-2.5 [&_h1]:mx-0 [&_h1]:wrap-anywhere max-[761px]:gap-[17px] max-[761px]:[&_h1]:text-[28px]">
                            <div>
                                <p className="eyebrow block text-[#89859e] text-[9px] font-semibold tracking-[.13em]">
                                    УСЕ ПІД КОНТРОЛЕМ
                                </p>
                                <h1>
                                    {activeSection === 'Огляд'
                                        ? `Вітаємо, ${userName.split(' ')[0]}`
                                        : activeSection}
                                </h1>
                                <p className="page-description text-subtle text-[13px]">
                                    {isProjects
                                        ? 'Ваші проєкти, оплати та наступні кроки.'
                                        : activeSection === 'Послуги та ціни'
                                          ? 'Власний прайс для вашої майстерності.'
                                          : 'Більше можливостей для вашої роботи.'}
                                </p>
                            </div>
                            {isProjects && (
                                <Button onClick={openForm} disabled={!!loadError} variant="brand">
                                    <Plus size={18} />
                                    Новий проєкт
                                </Button>
                            )}
                        </div>
                    )}
                    {notice && (
                        <p
                            role="status"
                            className="workspace-notice rounded-[10px] py-[15px] px-4.5 text-[12px] leading-[1.6] text-[#34755c] bg-[#edf7f1] border border-[#d7eddf]"
                        >
                            {notice}
                        </p>
                    )}
                    {isProjects && loadError && (
                        <div
                            role="alert"
                            className="workspace-error rounded-[10px] py-[15px] px-4.5 text-[12px] leading-[1.6] text-[#a14752] bg-[#fcf0f1] border border-[#f1dce0]"
                        >
                            <p>{loadError}</p>
                            <Button
                                onClick={() => window.location.reload()}
                                variant="outline"
                                className="mt-3"
                            >
                                Спробувати знову
                            </Button>
                        </div>
                    )}
                    {isProjects && showForm && (
                        <section
                            aria-labelledby="new-project-heading"
                            className="workspace-panel bg-[#fff] border border-line rounded-[14px] min-w-0 project-form-panel border-[#ddd7f5]! shadow-[0_5px_20px_#6155db06] [&_.eyebrow]:mb-[7px] [&_.workspace-error]:mt-0 [&_.workspace-error]:mx-6 [&_.workspace-error]:mb-5"
                        >
                            <div className="panel-heading flex justify-between items-start gap-4 pt-[25px] px-6 pb-5 [&_h2]:flex [&_h2]:items-center [&_h2]:gap-[9px] [&_h2]:text-[16px] [&_h2]:font-semibold [&_h2]:tracking-[-.03em] [&_p]:text-subtle [&_p]:text-[11px] [&_p]:mt-[7px] max-[761px]:pt-[21px] max-[761px]:px-4.5 max-[761px]:pb-4.5">
                                <div>
                                    <span className="eyebrow block text-[#89859e] text-[9px] font-semibold tracking-[.13em]">
                                        НОВИЙ ПОЧАТОК
                                    </span>
                                    <h2 id="new-project-heading">Створимо ваш проєкт</h2>
                                    <p>
                                        Вкажіть назву й клієнта. Вартість сформується з пунктів
                                        робіт.
                                    </p>
                                </div>
                                <button
                                    className="icon-button inline-flex items-center justify-center w-8 h-8 rounded-[8px] text-subtle shrink-0 [&:hover]:bg-[#f1f1f8]"
                                    disabled={saving}
                                    aria-label="Закрити форму"
                                    onClick={() => setShowForm(false)}
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            <form onSubmit={createProject}>
                                <fieldset
                                    disabled={saving}
                                    className="project-form-fields grid grid-cols-[1fr_1fr] gap-5 pt-1 px-6 pb-6 [&_label]:text-[#55596c] [&_label]:text-[12px] [&_label]:font-medium [&_label]:min-w-0 max-[761px]:grid-cols-[1fr] max-[761px]:px-4.5 max-[761px]:gap-[17px]"
                                >
                                    <label>
                                        Назва проєкту
                                        <input
                                            autoFocus
                                            name="name"
                                            placeholder="Наприклад, ремонт квартири"
                                            required
                                            maxLength={160}
                                            className={fieldClass}
                                        />
                                    </label>
                                    <label>
                                        Клієнт{' '}
                                        <span className="optional-label text-[10px] text-[#9295a4] font-normal ml-[5px]">
                                            необов’язково
                                        </span>
                                        <input
                                            name="client"
                                            placeholder="Ім’я або назва компанії"
                                            maxLength={160}
                                            className={fieldClass}
                                        />
                                    </label>
                                    <label>
                                        Статус
                                        <select name="status" className={fieldClass}>
                                            {projectStatuses.map((status) => (
                                                <option key={status}>{status}</option>
                                            ))}
                                        </select>
                                    </label>
                                </fieldset>
                                {error && (
                                    <p
                                        role="alert"
                                        className="workspace-error rounded-[10px] py-[15px] px-4.5 text-[12px] leading-[1.6] text-[#a14752] bg-[#fcf0f1] border border-[#f1dce0]"
                                    >
                                        {error}
                                    </p>
                                )}
                                <div className="form-actions py-4.5 px-6 border-t border-line flex justify-end gap-2.5 max-[761px]:px-4.5">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        disabled={saving}
                                        onClick={() => setShowForm(false)}
                                    >
                                        Скасувати
                                    </Button>
                                    <Button type="submit" disabled={saving} variant="brand">
                                        {saving ? 'Зберігаємо…' : 'Створити проєкт'}
                                        <ArrowUpRight size={17} />
                                    </Button>
                                </div>
                            </form>
                        </section>
                    )}
                    {isProjects && !loadError && (
                        <>
                            <section
                                className="workspace-stats grid grid-cols-3 gap-4.5 max-[761px]:grid-cols-2 max-[761px]:gap-2.5"
                                aria-label="Статистика проєктів"
                            >
                                {[
                                    {
                                        label: 'Активні проєкти',
                                        value: projects.filter((p) => p.status !== 'Завершено')
                                            .length,
                                        tone: 'indigo text-[#7868d6] bg-[#f0edfc]',
                                        note: 'Заплановані та в роботі',
                                        icon: BriefcaseBusiness,
                                    },
                                    {
                                        label: 'Зараз у роботі',
                                        value: projects.filter((p) => p.status === 'В роботі')
                                            .length,
                                        tone: 'amber text-[#bd9140] bg-[#fcf5e7]',
                                        note: 'Рухаємося до результату',
                                        icon: Hammer,
                                    },
                                    {
                                        label: 'До отримання',
                                        value: money(
                                            projects.reduce(
                                                (sum, p) =>
                                                    sum +
                                                    Math.max(
                                                        0,
                                                        Math.round(
                                                            (Number(p.total) - Number(p.paid)) *
                                                                100,
                                                        ),
                                                    ),
                                                0,
                                            ) / 100,
                                        ),
                                        tone: 'mint text-[#429a83] bg-[#eaf7f1]',
                                        note: 'Залишок оплат за проєктами',
                                        icon: Wallet,
                                    },
                                ].map(({ label, value, tone, note, icon: Icon }) => (
                                    <div
                                        key={label}
                                        className="stat-card min-w-0 bg-[#fff] border border-line rounded-[14px] py-5 px-5.5 shadow-[0_2px_3px_#20233202] max-[1200px]:p-[17px] max-[761px]:[&:last-child]:col-span-full max-[761px]:p-4"
                                    >
                                        <div className="stat-top flex items-center justify-between gap-2.5 text-[#686c7f] text-[12px] font-medium max-[761px]:text-[11px]">
                                            <span>{label}</span>
                                            <span
                                                className={`stat-icon inline-flex items-center justify-center w-8.5 h-8.5 rounded-[10px] shrink-0 max-[761px]:w-[29px] max-[761px]:h-[29px] max-[761px]:[&_svg]:w-4 ${tone}`}
                                            >
                                                <Icon size={19} strokeWidth={1.7} />
                                            </span>
                                        </div>
                                        <p className="stat-value text-[clamp(22px,_2.2vw,_32px)] font-[550] tracking-[-.045em] tabular-nums mt-[15px] mx-0 mb-[9px] wrap-anywhere max-[761px]:text-[27px] max-[761px]:my-[9px] max-[761px]:mx-0">
                                            {value}
                                        </p>
                                        <p className="stat-note text-[#8a8e9d] text-[10px] max-[761px]:text-[9px]">
                                            {note}
                                        </p>
                                    </div>
                                ))}
                            </section>
                            {projects.length === 0 ? (
                                <section className="workspace-panel bg-[#fff] border border-line rounded-[14px] min-w-0 empty-projects py-14.5 px-6 text-center [&_h2]:text-[23px] [&_h2]:font-[550] [&_h2]:tracking-[-.04em] [&_h2]:my-2.5 [&_h2]:mx-0 [&_>_p]:text-[12px] [&_>_p]:leading-[1.9] [&_>_p]:text-subtle [&_>_p]:max-w-92.5 [&_>_p]:mt-0 [&_>_p]:mx-auto [&_>_p]:mb-[25px] max-[761px]:py-[45px] max-[761px]:px-4.5 max-[761px]:[&_h2]:text-[22px]">
                                    <div
                                        className="empty-art relative flex items-center justify-center w-21.5 h-21.5 rounded-[24px] mt-0 mx-auto mb-7.5 bg-[#f1effb] text-[#8d7ec9] border border-[#e8e3f7] rotate-[-6deg] [&_>_svg]:rotate-[6deg] [&_i]:inline-flex [&_i]:absolute [&_i]:bottom-[-5px] [&_i]:right-[-7px] [&_i]:p-1.5 [&_i]:bg-[#6155db] [&_i]:text-[#fff] [&_i]:rounded-[9px] [&_i]:border-3 [&_i]:border-[#fff]"
                                        aria-hidden="true"
                                    >
                                        <span />
                                        <FolderOpen size={35} strokeWidth={1.3} />
                                        <i>
                                            <Plus size={16} />
                                        </i>
                                    </div>
                                    <span className="eyebrow block text-[#89859e] text-[9px] font-semibold tracking-[.13em]">
                                        МІСЦЕ ДЛЯ ВАШИХ ІДЕЙ
                                    </span>
                                    <h2>Перший проєкт починається тут</h2>
                                    <p>
                                        Додайте назву й клієнта, а потім роботи з прайсу.
                                        <br />
                                        Ми допоможемо тримати фінанси в порядку.
                                    </p>
                                    <Button onClick={openForm} variant="brand">
                                        <Plus size={17} />
                                        Створити перший проєкт
                                    </Button>
                                </section>
                            ) : (
                                <section className="projects-layout grid grid-cols-[minmax(0,_1fr)_310px] gap-5.5 items-start min-[1600px]:grid-cols-[minmax(0,_1fr)_360px] max-[1200px]:grid-cols-[minmax(0,_1fr)] max-[1024px]:grid-cols-[minmax(0,_1fr)_290px] max-[1024px]:gap-4 max-[761px]:grid-cols-[minmax(0,_1fr)]">
                                    <div className="workspace-panel bg-[#fff] border border-line rounded-[14px] min-w-0 project-list-panel">
                                        <div className="panel-heading flex justify-between items-start gap-4 pt-[25px] px-6 pb-5 [&_h2]:flex [&_h2]:items-center [&_h2]:gap-[9px] [&_h2]:text-[16px] [&_h2]:font-semibold [&_h2]:tracking-[-.03em] [&_p]:text-subtle [&_p]:text-[11px] [&_p]:mt-[7px] max-[761px]:pt-[21px] max-[761px]:px-4.5 max-[761px]:pb-4.5">
                                            <div>
                                                <h2>
                                                    Ваші проєкти{' '}
                                                    <span className="count-badge inline-flex py-[1px] px-[7px] bg-[#f2f1f8] text-[#817793] rounded-[5px] text-[10px]">
                                                        {projects.length}
                                                    </span>
                                                </h2>
                                                <p>Від маленьких завдань до великих змін.</p>
                                            </div>
                                        </div>
                                        <div className="project-toolbar flex gap-2.5 pt-0 px-6 pb-5 [&_select]:border [&_select]:border-line [&_select]:rounded-[8px] [&_select]:text-[#717486] [&_select]:py-0 [&_select]:px-2 [&_select]:text-[11px] [&_select]:max-w-35 [&_select]:bg-[#fff] max-[761px]:px-4.5 max-[761px]:flex-wrap max-[761px]:[&_select]:min-h-9">
                                            <label className="project-search flex gap-2 items-center border border-line rounded-[8px] py-[9px] px-2.5 text-[#9295a5] min-w-0 flex-1 [&_input]:w-full [&_input]:min-w-0 [&_input]:outline-none [&_input]:text-ink [&_input]:text-[11px] [&_input]:bg-[transparent] [&:focus-within]:border-[#a59ced] max-[761px]:basis-47.5">
                                                <Search size={17} />
                                                <input
                                                    aria-label="Пошук проєкту або клієнта"
                                                    placeholder="Знайти проєкт або клієнта…"
                                                    value={query}
                                                    onChange={(event) =>
                                                        setQuery(event.target.value)
                                                    }
                                                />
                                            </label>
                                            <select
                                                aria-label="Фільтр за статусом"
                                                value={filter}
                                                onChange={(event) => setFilter(event.target.value)}
                                            >
                                                <option>Усі</option>
                                                {projectStatuses.map((status) => (
                                                    <option key={status}>{status}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="project-list pt-0 px-3 pb-3">
                                            {visibleProjects.map((project) => (
                                                <button
                                                    key={project.id}
                                                    onClick={() => setSelectedId(project.id)}
                                                    aria-pressed={selectedId === project.id}
                                                    className="project-row flex w-full items-center gap-3 text-left border border-[transparent] rounded-[10px] py-[17px] px-3 [transition:background_.15s,_border-color_.15s] [&_+_.project-row]:mt-[5px] [&:hover]:bg-[#f9f9fc] [&[aria-pressed=true]]:bg-[#f7f6fd] [&[aria-pressed=true]]:border-[#e8e4fa] max-[761px]:gap-[9px] max-[761px]:py-3.5 max-[761px]:px-[9px] max-[761px]:flex-wrap"
                                                >
                                                    <span className="project-row-icon w-10 h-11 inline-flex items-center justify-center bg-[#f0eef9] text-[#8676bd] rounded-[9px] shrink-0 max-[761px]:w-[33px] max-[761px]:h-9.5">
                                                        <FolderOpen size={21} strokeWidth={1.6} />
                                                    </span>
                                                    <span className="project-row-info flex-1 min-w-0 max-[761px]:min-w-[125px]">
                                                        <span className="project-row-name block text-[12px] font-[550] wrap-anywhere">
                                                            {project.name}
                                                        </span>
                                                        <span className="project-row-client block text-[#8a8d9b] text-[10px] mt-[5px] wrap-anywhere">
                                                            {project.client || 'Клієнт не вказаний'}
                                                        </span>
                                                        <span
                                                            className={`status-pill inline-flex items-center gap-[5px] text-[9px] font-medium rounded-[5px] py-[3px] px-1.5 mt-2 [&_>_span]:w-1 [&_>_span]:h-1 [&_>_span]:rounded-full [&_>_span]:bg-[currentColor] ${project.status === 'В роботі' ? 'status-active bg-[#eeebfa] text-[#7562b6]' : project.status === 'Завершено' ? 'status-done bg-[#eaf5ee] text-[#408b65]' : 'status-waiting bg-[#fbf3e6] text-[#a17f3a]'}`}
                                                        >
                                                            <span />
                                                            {project.status}
                                                        </span>
                                                    </span>
                                                    <span className="project-row-amount flex items-center justify-end gap-[9px] font-[550] text-[12px] tabular-nums [&_svg]:text-[#a9a4c0] [&_svg]:shrink-0 max-[761px]:text-[11px]">
                                                        {money(Number(project.total))}
                                                        <ChevronRight size={16} />
                                                    </span>
                                                </button>
                                            ))}
                                            {visibleProjects.length === 0 && (
                                                <div className="search-empty text-center py-7.5 px-2.5 text-subtle text-[12px] [&_svg]:mt-0 [&_svg]:mx-auto [&_svg]:mb-2.5 [&_h3]:font-[550] [&_h3]:text-ink [&_h3]:mb-1.5 [&_p]:mb-2.5">
                                                    <Search size={25} />
                                                    <h3>Нічого не знайдено</h3>
                                                    <p>Спробуйте іншу назву або змініть статус.</p>
                                                    <Button
                                                        variant="ghost"
                                                        onClick={() => {
                                                            setQuery('');
                                                            setFilter('Усі');
                                                        }}
                                                    >
                                                        Скинути фільтри
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                        <div className="list-footer border-t border-line py-[13px] px-6 text-[#989baa] text-[10px]">
                                            Показано {visibleProjects.length} із {projects.length}
                                        </div>
                                    </div>
                                    {selected && (
                                        <aside
                                            className="project-details bg-[#262738] text-[#fff] border border-[#343548] rounded-[14px] p-[25px] min-w-0 [&_h2]:text-[22px] [&_h2]:font-[550] [&_h2]:leading-[1.35] [&_h2]:tracking-[-.04em] [&_h2]:wrap-anywhere max-[761px]:p-6"
                                            aria-label="Деталі обраного проєкту"
                                        >
                                            <div className="detail-top flex items-center justify-between text-[#a4a3bc] text-[9px] tracking-[.11em]">
                                                <span>ДЕТАЛІ ПРОЄКТУ</span>
                                                <ArrowUpRight size={18} />
                                            </div>
                                            <div className="detail-folder inline-flex p-3 mt-[25px] mx-0 mb-[17px] bg-[#39394f] text-[#c2b8fb] border border-[#48465e] rounded-[12px]">
                                                <FolderOpen size={26} strokeWidth={1.5} />
                                            </div>
                                            <h2>{selected.name}</h2>
                                            <p className="detail-client flex items-center gap-1.5 text-[#a9a8bb] text-[11px] mt-2.5 wrap-anywhere [&_svg]:shrink-0">
                                                <UserRound size={14} />
                                                {selected.client || 'Клієнт не вказаний'}
                                            </p>
                                            <span className="detail-status inline-flex items-center gap-[5px] mt-[17px] py-1 px-2 border border-[#4e4962] text-[#d2c8f2] bg-[#383549] rounded-[5px] text-[10px]">
                                                {selected.status === 'Завершено' && (
                                                    <Check size={13} />
                                                )}
                                                {selected.status}
                                            </span>
                                            <div className="detail-total mt-[27px] mx-0 mb-[23px] pt-6 border-t border-[#ffffff12] [&_>_span]:text-[11px] [&_>_span]:text-[#a9a8bb] [&_p]:text-[29px] [&_p]:font-[550] [&_p]:tracking-[-.045em] [&_p]:mt-[7px] [&_p]:wrap-anywhere [&_p]:tabular-nums">
                                                <span>Вартість проєкту</span>
                                                <p>{money(Number(selected.total))}</p>
                                            </div>
                                            <div className="payment-heading flex justify-between text-[10px] text-[#c5c2d7]">
                                                <span>Оплачено</span>
                                                <span>{paymentPercent}%</span>
                                            </div>
                                            <div
                                                className="payment-track h-[5px] rounded-[9px] bg-[#ffffff12] overflow-hidden mt-[9px] mx-0 mb-5.5 [&_>_span]:block [&_>_span]:h-full [&_>_span]:rounded-[inherit] [&_>_span]:bg-[#b4a1f4] [&_>_span]:[transition:width_.25s]"
                                                role="progressbar"
                                                aria-label="Частка оплаченої суми"
                                                aria-valuemin={0}
                                                aria-valuemax={100}
                                                aria-valuenow={paymentPercent}
                                            >
                                                <span style={{ width: `${paymentPercent}%` }} />
                                            </div>
                                            <dl className="detail-amounts grid gap-3 text-[11px] [&_>_div]:flex [&_>_div]:justify-between [&_>_div]:flex-wrap [&_>_div]:gap-1.5 [&_dt]:text-[#a9a8bb] [&_dd]:font-medium [&_dd]:tabular-nums">
                                                <div>
                                                    <dt>Вже отримано</dt>
                                                    <dd>{money(Number(selected.paid))}</dd>
                                                </div>
                                                <div>
                                                    <dt>Залишилось</dt>
                                                    <dd>
                                                        {money(
                                                            Math.max(
                                                                0,
                                                                Math.round(
                                                                    Number(selected.total) * 100,
                                                                ) -
                                                                    Math.round(
                                                                        Number(selected.paid) * 100,
                                                                    ),
                                                            ) / 100,
                                                        )}
                                                    </dd>
                                                </div>
                                            </dl>
                                            <div className="detail-footnote flex items-center gap-[7px] pt-[23px] mt-[23px] border-t border-[#ffffff12] text-[#9996af] text-[9px]">
                                                <CircleDollarSign size={16} />
                                                <span>Усі суми в українській гривні</span>
                                            </div>
                                        </aside>
                                    )}
                                </section>
                            )}
                        </>
                    )}
                    {isProjects && selected && !loadError && (
                        <ProjectEstimate
                            key={selected.id}
                            projectId={selected.id}
                            userId={userId}
                            onProjectChange={updateProject}
                            openPriceList={() => navigateSection('Послуги та ціни')}
                        />
                    )}
                    {activeSection === 'Послуги та ціни' && (
                        <PriceList userId={userId} userName={userName} />
                    )}
                    {activeSection === 'Портфоліо' && (
                        <section className="workspace-panel bg-[#fff] border border-line rounded-[14px] min-w-0 empty-projects py-14.5 px-6 text-center [&_h2]:text-[23px] [&_h2]:font-[550] [&_h2]:tracking-[-.04em] [&_h2]:my-2.5 [&_h2]:mx-0 [&_>_p]:text-[12px] [&_>_p]:leading-[1.9] [&_>_p]:text-subtle [&_>_p]:max-w-92.5 [&_>_p]:mt-0 [&_>_p]:mx-auto [&_>_p]:mb-[25px] max-[761px]:py-[45px] max-[761px]:px-4.5 max-[761px]:[&_h2]:text-[22px]">
                            <div
                                className="empty-art relative flex items-center justify-center w-21.5 h-21.5 rounded-[24px] mt-0 mx-auto mb-7.5 bg-[#f1effb] text-[#8d7ec9] border border-[#e8e3f7] rotate-[-6deg] [&_>_svg]:rotate-[6deg] [&_i]:inline-flex [&_i]:absolute [&_i]:bottom-[-5px] [&_i]:right-[-7px] [&_i]:p-1.5 [&_i]:bg-[#6155db] [&_i]:text-[#fff] [&_i]:rounded-[9px] [&_i]:border-3 [&_i]:border-[#fff]"
                                aria-hidden="true"
                            >
                                <Camera size={35} strokeWidth={1.3} />
                            </div>
                            <span className="eyebrow block text-[#89859e] text-[9px] font-semibold tracking-[.13em]">
                                НЕЗАБАРОМ У ВАШОМУ ПРОСТОРІ
                            </span>
                            <h2>Роботи, якими ви пишаєтесь</h2>
                            <p>
                                Портфоліо ще готується. Зараз можна вести проєкти та їхні фінанси.
                            </p>
                            <Button variant="outline" onClick={() => navigateSection('Проекти')}>
                                До моїх проєктів
                                <ArrowUpRight size={17} />
                            </Button>
                        </section>
                    )}
                    <footer className="workspace-footer flex justify-between gap-[15px] pt-[7px] text-[#989baa] text-[10px] [&_>_span:first-child]:font-medium max-[761px]:text-[9px]">
                        <span>Мій кошторис</span>
                        <span>Менше рутини. Більше зробленого.</span>
                    </footer>
                </div>
            </main>
            <nav
                aria-label="Мобільна навігація"
                className="workspace-mobile-nav grid grid-cols-4 fixed [inset:auto_0_0] z-[100] pt-1.5 pr-[max(8px,_env(safe-area-inset-right))] pb-[calc(6px_+_env(safe-area-inset-bottom))] pl-[max(8px,_env(safe-area-inset-left))] bg-[#fffffff5] backdrop-blur-[16px] border-t border-line shadow-[0_-4px_20px_#24213b06] [&_a]:flex [&_a]:flex-col [&_a]:items-center [&_a]:justify-center [&_a]:gap-[3px] [&_a]:min-h-15.5 [&_a]:min-w-0 [&_a]:p-0.5 [&_a]:text-[#737789] [&_a]:text-center [&_a]:no-underline [&_a[aria-current]]:text-brand [&_a[aria-current]_.mobile-nav-icon]:bg-[#efedfc] [&_a:focus-visible]:[outline:2px_solid_var(--brand)] [&_a:focus-visible]:[outline-offset:2px] [&_a:focus-visible]:rounded-[8px] min-[1024px]:hidden"
            >
                {navigation.map(({ label, icon: Icon }) => (
                    <a
                        key={label}
                        href={sectionHref(label)}
                        onClick={(event) => followSection(event, label)}
                        aria-current={activeSection === label ? 'page' : undefined}
                    >
                        <span className="mobile-nav-icon flex items-center justify-center w-13 h-7.5 rounded-[12px]">
                            <Icon
                                size={23}
                                strokeWidth={activeSection === label ? 2.2 : 1.7}
                                aria-hidden="true"
                            />
                        </span>
                        <span className="mobile-nav-label text-[11px] leading-[15px] font-medium">
                            {label === 'Проекти' ? 'Проєкти' : label}
                        </span>
                    </a>
                ))}
            </nav>
        </div>
    );
}
