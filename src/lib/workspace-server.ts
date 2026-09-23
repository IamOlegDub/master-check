import 'server-only';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { profileFromUser, profileName } from '@/lib/profile';
import type { Role } from '@/lib/workspace';

export async function workspaceContext(requireMaster = false) {
    const supabase = await createSupabaseServerClient();
    if (!supabase) redirect('/login');
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/login');
    const { data: account, error } = await supabase
        .from('accounts')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
    if (error)
        throw new Error(
            'Потрібно застосувати міграції робочого простору 202609230001 та 202609230002 у Supabase.',
        );
    if (!account) redirect('/welcome');
    if (requireMaster && account.role !== 'MASTER') redirect('/');
    const profile = profileFromUser(user);
    return { supabase, user, profile, name: profileName(profile), role: account.role as Role };
}
