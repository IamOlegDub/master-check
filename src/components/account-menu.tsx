'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu } from '@base-ui/react/menu';
import { Settings, LogOut } from 'lucide-react';
import { initials } from '@/lib/profile';

export function Avatar({
    name,
    url,
    className = '',
}: {
    name: string;
    url?: string;
    className?: string;
}) {
    const [failed, setFailed] = useState('');
    return (
        <span
            className={`user-avatar inline-flex size-[34px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--tone-bg-eeebf8)] text-xs font-semibold text-[var(--tone-text-695a9f)] ${className}`}
        >
            {url && failed !== url ? (
                <img
                    className="size-full object-cover"
                    src={url}
                    alt=""
                    referrerPolicy="no-referrer"
                    onError={() => setFailed(url)}
                />
            ) : (
                initials(name)
            )}
        </span>
    );
}

export function AccountMenu({
    name,
    avatarUrl,
    onSignOut,
}: {
    name: string;
    avatarUrl?: string;
    onSignOut: () => void;
}) {
    return (
        <Menu.Root>
            <Menu.Trigger
                className="account-trigger flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full"
                aria-label="Меню акаунта"
            >
                <Avatar name={name} url={avatarUrl} />
            </Menu.Trigger>
            <Menu.Portal>
                <Menu.Positioner sideOffset={8} align="end" className="z-[200]">
                    <Menu.Popup className="account-menu w-[230px] max-w-[calc(100vw-24px)] rounded-2xl border border-line bg-card p-2 shadow-xl">
                        <p className="mb-1 border-b border-line p-2.5 text-xs text-subtle wrap-anywhere">
                            {name}
                        </p>
                        <Menu.LinkItem
                            render={<Link href="/settings" />}
                            closeOnClick
                            className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg p-2.5 text-sm outline-none data-highlighted:bg-[var(--tone-bg-f1effb)]"
                        >
                            <Settings size={18} />
                            Налаштування
                        </Menu.LinkItem>
                        <Menu.Item
                            onClick={onSignOut}
                            className="account-menu-logout flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg p-2.5 text-sm text-[var(--tone-text-b34352)] outline-none data-highlighted:bg-[var(--tone-bg-f1effb)]"
                        >
                            <LogOut size={18} />
                            Вийти
                        </Menu.Item>
                    </Menu.Popup>
                </Menu.Positioner>
            </Menu.Portal>
        </Menu.Root>
    );
}
