import { Dashboard } from '@/components/dashboard';
import { LoginScreen } from '@/components/login-screen';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { projectError, type Project } from '@/lib/projects';
import { profileFromUser, profileName } from '@/lib/profile';

export default async function Home() {
    const supabase = await createSupabaseServerClient();

    if (!supabase) {
        return <LoginScreen configured={false} />;
    }

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return <LoginScreen configured />;
    }

    let projects: Project[] = [];
    let loadError: string | null = null;
    try {
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
        if (error) loadError = projectError(error);
        else projects = (data ?? []) as Project[];
    } catch {
        loadError = projectError(null);
    }

    return (
        <Dashboard
            initialProjects={projects}
            loadError={loadError}
            userId={user.id}
            userName={profileName(profileFromUser(user))}
            initialProfile={profileFromUser(user)}
        />
    );
}
