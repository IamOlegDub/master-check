import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

import { getSupabaseEnv } from '@/lib/supabase/env';

export async function GET(request: Request) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const next = requestUrl.searchParams.get('next') ?? '/';
    const env = getSupabaseEnv();

    if (!code || !env) {
        return NextResponse.redirect(
            new URL('/login?error=auth_config', requestUrl.origin),
        );
    }

    const response = NextResponse.redirect(new URL(next, requestUrl.origin));
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
        return NextResponse.redirect(
            new URL('/login?error=auth_callback', requestUrl.origin),
        );
    }

    return response;
}
