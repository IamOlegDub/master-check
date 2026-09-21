'use client';

import { useState } from 'react';
import { Menu } from '@base-ui/react/menu';
import { Settings, LogOut } from 'lucide-react';
import { initials } from '@/lib/profile';

export function Avatar({ name, url, className = '' }: { name: string; url?: string; className?: string }) {
    const [failed, setFailed] = useState('');
    return <span className={`user-avatar ${className}`}>
        {url && failed !== url ? <img src={url} alt="" referrerPolicy="no-referrer" onError={() => setFailed(url)} /> : initials(name)}
    </span>;
}

export function AccountMenu({ name, avatarUrl, onSignOut }: { name: string; avatarUrl?: string; onSignOut: () => void }) {
    return <Menu.Root>
        <Menu.Trigger className="account-trigger" aria-label="Меню акаунта"><Avatar name={name} url={avatarUrl} /></Menu.Trigger>
        <Menu.Portal><Menu.Positioner sideOffset={8} align="end" className="account-menu-positioner">
            <Menu.Popup className="account-menu">
                <p className="account-menu-name">{name}</p>
                <Menu.LinkItem href="/settings" closeOnClick><Settings size={18} />Налаштування</Menu.LinkItem>
                <Menu.Item onClick={onSignOut} className="account-menu-logout"><LogOut size={18} />Вийти</Menu.Item>
            </Menu.Popup>
        </Menu.Positioner></Menu.Portal>
    </Menu.Root>;
}
