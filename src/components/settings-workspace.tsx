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
}: {
    initial: Profile;
    role: Role;
    userId: string;
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
            <InstallApp />
        </WorkspaceShell>
    );
}
