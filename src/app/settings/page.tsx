import { redirect } from 'next/navigation';
import { Dashboard } from '@/components/dashboard';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { profileFromUser, profileName } from '@/lib/profile';

export default async function SettingsPage() {
    const supabase = await createSupabaseServerClient();
    if (!supabase) redirect('/login');
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/login');
    const profile = profileFromUser(user);
    return (
        <Dashboard
            initialProjects={[]}
            loadError={null}
            userId={user.id}
            userName={profileName(profile)}
            initialProfile={profile}
            settingsPage
        />
    );
}
