'use client';
import { type ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ClipboardList, Hammer, Camera, Users, Sparkles } from 'lucide-react';
import { AccountMenu } from '@/components/account-menu';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Role } from '@/lib/workspace';

export function WorkspaceShell({
    children,
    role,
    name,
    avatar,
    title,
    projectPage = false,
}: {
    children: ReactNode;
    role: Role;
    name: string;
    avatar?: string;
    title: string;
    projectPage?: boolean;
}) {
    const path = usePathname();
    const [error, setError] = useState('');
    const links = [
        { href: '/', label: 'Огляд', icon: Home },
        { href: '/projects', label: 'Проєкти', icon: ClipboardList },
        ...(role === 'MASTER'
            ? [
                  { href: '/services', label: 'Послуги', icon: Hammer },
                  { href: '/clients', label: 'Клієнти', icon: Users },
                  { href: '/portfolio', label: 'Портфоліо', icon: Camera },
              ]
            : []),
    ];
    async function logout() {
        try {
            const client = createSupabaseBrowserClient();
            if (!client) throw Error('Offline');
            const result = await client.auth.signOut();
            if (result.error) throw result.error;
            window.location.assign('/login');
        } catch {
            setError('Не вдалося вийти. Спробуйте знову.');
        }
    }
    return (
        <div className="min-h-dvh bg-[#f7f8fb] text-sm text-ink">
            <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-line bg-white p-5 lg:flex">
                <Link href="/" className="mb-12 flex items-center gap-3 text-lg font-semibold">
                    <Sparkles className="text-brand" />
                    Мій кошторис
                </Link>
                <p className="mb-4 text-xs text-subtle">
                    {role === 'MASTER' ? 'ПРОСТІР МАЙСТРА' : 'ПРОСТІР ЗАМОВНИКА'}
                </p>
                <nav aria-label="Основна навігація" className="grid gap-2">
                    {links.map(({ href, label, icon: Icon }) => (
                        <Link
                            key={href}
                            href={href}
                            aria-current={
                                path === href ||
                                (href !== '/' && path.startsWith(href + '/')) ||
                                (projectPage && href === '/projects')
                                    ? 'page'
                                    : undefined
                            }
                            className="flex min-h-11 items-center gap-3 rounded-xl p-3 hover:bg-[#f7f6fd] aria-[current=page]:bg-[#efedfc] aria-[current=page]:text-brand"
                        >
                            <Icon size={20} />
                            {label}
                        </Link>
                    ))}
                </nav>
                <Link href="/settings" className="mt-auto break-words border-t border-line pt-5">
                    {name}
                    <span className="block text-xs text-subtle">Налаштування профілю</span>
                </Link>
            </aside>
            <main className="pb-[calc(96px+env(safe-area-inset-bottom))] lg:ml-60 lg:pb-6">
                <header className="flex min-h-16 items-center justify-between gap-3 border-b border-line bg-white px-4 sm:px-8">
                    <nav
                        aria-label="Шлях навігації"
                        className="flex min-w-0 flex-wrap items-center gap-2 text-xs"
                    >
                        <Link href="/" className="py-3 text-subtle">
                            Огляд
                        </Link>
                        {path !== '/' && (
                            <>
                                <span aria-hidden>›</span>
                                {(projectPage || path.startsWith('/projects/')) && (
                                    <>
                                        <Link href="/projects" className="py-3 text-subtle">
                                            Проєкти
                                        </Link>
                                        <span aria-hidden>›</span>
                                    </>
                                )}
                                <span className="max-w-full wrap-anywhere" aria-current="page">
                                    {title}
                                </span>
                            </>
                        )}
                    </nav>
                    <AccountMenu name={name} avatarUrl={avatar} onSignOut={() => void logout()} />
                </header>
                {error && (
                    <p role="alert" className="m-4 rounded-xl bg-red-50 p-4 text-red-700">
                        {error}
                    </p>
                )}
                <div
                    className={
                        path === '/settings'
                            ? 'mx-auto max-w-7xl px-[18px] lg:px-8 lg:pt-8'
                            : 'mx-auto grid max-w-7xl gap-6 p-4 sm:p-8'
                    }
                >
                    {children}
                </div>
            </main>
            <nav
                aria-label="Мобільна навігація"
                className={`fixed inset-x-0 bottom-0 z-40 grid ${role === 'MASTER' ? 'grid-cols-5' : 'grid-cols-2'} border-t border-line bg-white/95 px-1 pt-1 pb-[calc(6px+env(safe-area-inset-bottom))] backdrop-blur-lg lg:hidden`}
            >
                {links.map(({ href, label, icon: Icon }) => (
                    <Link
                        key={href}
                        href={href}
                        aria-current={
                            path === href ||
                            (href !== '/' && path.startsWith(href + '/')) ||
                            (projectPage && href === '/projects')
                                ? 'page'
                                : undefined
                        }
                        className="flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-[10px] text-subtle aria-[current=page]:bg-[#efedfc] aria-[current=page]:text-brand"
                    >
                        <Icon size={21} />
                        <span>{label}</span>
                    </Link>
                ))}
            </nav>
        </div>
    );
}
