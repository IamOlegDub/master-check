'use client';
import { InstallApp } from '@/components/pwa';
import { useState } from 'react';
import { WorkspaceShell } from '@/components/workspace-shell';
import { ProfileSettings } from '@/components/profile-settings';
import { profileName, type Profile } from '@/lib/profile';
import type { Role } from '@/lib/workspace';
export function SettingsWorkspace({
    initial,
    role,
    userId,
    username,
}: {
    initial: Profile;
    role: Role;
    userId: string;
    username?: string | null;
}) {
    const [profile, setProfile] = useState(initial);
    return (
        <WorkspaceShell
            role={role}
            name={profileName(profile)}
            avatar={profile.avatarUrl}
            title="Налаштування"
        >
            <ProfileSettings profile={profile} userId={userId} onSaved={setProfile} />
            {username && (
                <section className="mt-6 rounded-2xl border border-line bg-white p-5">
                    <h2 className="font-semibold">Адреса майстра</h2>
                    <p className="mt-2 text-brand">@{username}</p>
                    <p className="mt-2 text-xs text-subtle">
                        Username є частиною адрес проєктів і залишається незмінним, щоб надіслані
                        посилання працювали.
                    </p>
                </section>
            )}
            <InstallApp />
        </WorkspaceShell>
    );
}
