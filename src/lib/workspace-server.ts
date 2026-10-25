import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isTemporaryAuthError } from '@/lib/auth-redirect';
import { profileFromUser, profileName } from '@/lib/profile';
import type { Role } from '@/lib/workspace';

const getWorkspaceContext = cache(async () => {
    const supabase = await createSupabaseServerClient();
    if (!supabase) redirect('/login');
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();
    if (isTemporaryAuthError(authError))
        throw new Error(
            'Не вдалося перевірити сесію. Оновіть сторінку, повторний вхід не потрібен.',
        );
    if (!user) redirect('/login');
    const { data: account, error } = await supabase
        .from('accounts')
        .select('role,username')
        .eq('user_id', user.id)
        .maybeSingle();
    if (error)
        throw new Error('Потрібно застосувати всі міграції з supabase/migrations у Supabase.');
    if (!account) redirect('/welcome');
    if (account.role === 'MASTER' && !account.username) redirect('/welcome');
    const profile = profileFromUser(user);
    return {
        supabase,
        user,
        profile,
        name: profileName(profile),
        role: account.role as Role,
        username: account.username as string | null,
    };
});
export async function workspaceContext(requireMaster = false) {
    const context = await getWorkspaceContext();
    if (requireMaster && context.role !== 'MASTER') redirect('/');
    return context;
}
export async function workspaceProjects(context: Awaited<ReturnType<typeof workspaceContext>>) {
    const [projects, contacts] = await Promise.all([
        context.supabase.rpc('workspace_projects'),
        context.role === 'MASTER'
            ? context.supabase.from('clients').select('*').order('name')
            : Promise.resolve({ data: [], error: null }),
    ]);
    if (projects.error)
        throw Error('Не вдалося завантажити проєкти. Перевірте міграції та з’єднання.');
    if (contacts.error) throw Error('Не вдалося завантажити клієнтів.');
    return { projects: projects.data ?? [], contacts: contacts.data ?? [] };
}
