import { notFound, redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { validId } from '@/lib/workspace';
import { AcceptInvite } from '@/components/accept-invite';
export default async function Invite({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    if (!validId(token)) notFound();
    const c = await createSupabaseServerClient();
    const user = c ? (await c.auth.getUser()).data.user : null;
    if (!user) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
    return <AcceptInvite token={token} />;
}
