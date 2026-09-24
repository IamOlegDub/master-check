import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { RoleChoice } from '@/components/role-choice';
export default async function Welcome() {
    const c = await createSupabaseServerClient();
    if (!c) redirect('/login');
    const {
        data: { user },
    } = await c.auth.getUser();
    if (!user) redirect('/login');
    const { data, error } = await c
        .from('accounts')
        .select('role,username')
        .eq('user_id', user.id)
        .maybeSingle();
    if (error) throw error;
    if (data && (data.role === 'CLIENT' || data.username)) redirect('/');
    return <RoleChoice existingMaster={data?.role === 'MASTER'} />;
}
