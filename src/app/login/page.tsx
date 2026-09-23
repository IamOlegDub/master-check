import { LoginScreen } from '@/components/login-screen';
import { hasSupabaseEnv } from '@/lib/supabase/env';
import { safeReturnPath } from '@/lib/auth-redirect';

export default async function LoginPage({
    searchParams,
}: {
    searchParams: Promise<{ next?: string }>;
}) {
    return (
        <LoginScreen
            configured={hasSupabaseEnv()}
            nextPath={safeReturnPath((await searchParams).next)}
        />
    );
}
