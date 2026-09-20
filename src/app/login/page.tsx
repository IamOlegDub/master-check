import { LoginScreen } from '@/components/login-screen';
import { hasSupabaseEnv } from '@/lib/supabase/env';

export default function LoginPage() {
    return <LoginScreen configured={hasSupabaseEnv()} />;
}
