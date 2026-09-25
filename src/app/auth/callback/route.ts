import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

import { getSupabaseEnv } from '@/lib/supabase/env';
import { safeReturnPath } from '@/lib/auth-redirect';

export async function GET(request: Request) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const savedNext = request.headers
        .get('cookie')
        ?.split(';')
        .map((v) => v.trim())
        .find((v) => v.startsWith('mc-auth-next='))
        ?.slice('mc-auth-next='.length);
    let cookieNext = '/';
    try {
        cookieNext = decodeURIComponent(savedNext ?? '/');
    } catch {}
    const next = safeReturnPath(requestUrl.searchParams.get('next') ?? cookieNext);
    const env = getSupabaseEnv();

    if (!code || !env) {
        return NextResponse.redirect(new URL('/login?error=auth_config', requestUrl.origin));
    }

    const response = NextResponse.redirect(new URL(next, requestUrl.origin));
    response.cookies.set('mc-auth-next', '', { path: '/auth/callback', maxAge: 0 });
    const supabase = createServerClient(env.url, env.key, {
        cookies: {
            getAll() {
                return (
                    request.headers
                        .get('cookie')
                        ?.split('; ')
                        .filter(Boolean)
                        .map((item) => {
                            const [name, ...value] = item.split('=');
                            return { name, value: value.join('=') };
                        }) ?? []
                );
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value, options }) =>
                    response.cookies.set(name, value, options),
                );
            },
        },
    });

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
        return NextResponse.redirect(new URL('/login?error=auth_callback', requestUrl.origin));
    }

    return response;
}
