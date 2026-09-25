'use client';
import { InstallApp } from '@/components/pwa';
import { ThemePicker } from '@/components/theme-provider';
import { useState } from 'react';
import { useWorkspaceAccount } from '@/components/workspace-shell';
import { ProfileSettings } from '@/components/profile-settings';
import { profileName, type Profile } from '@/lib/profile';
export function SettingsWorkspace({
    initial,
    userId,
    username,
}: {
    initial: Profile;
    userId: string;
    username?: string | null;
}) {
    const updateAccount = useWorkspaceAccount();
    const [profile, setProfile] = useState(initial);
    return (
        <>
            <ProfileSettings
                profile={profile}
                userId={userId}
                onSaved={(value) => {
                    setProfile(value);
                    updateAccount({ name: profileName(value), avatar: value.avatarUrl });
                }}
            />
            {username && (
                <section className="mt-6 rounded-2xl border border-line bg-card p-5">
                    <h2 className="font-semibold">Адреса майстра</h2>
                    <p className="mt-2 text-brand">@{username}</p>
                    <p className="mt-2 text-xs text-subtle">
                        Username є частиною адрес проєктів і залишається незмінним, щоб надіслані
                        посилання працювали.
                    </p>
                </section>
            )}
            <section className="mt-6 rounded-2xl border border-line bg-card p-5">
                <ThemePicker />
            </section>
            <InstallApp />
        </>
    );
}
