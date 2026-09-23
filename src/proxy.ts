import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { getSupabaseEnv } from '@/lib/supabase/env';
import { safeReturnPath } from '@/lib/auth-redirect';

export async function proxy(request: NextRequest) {
    const env = getSupabaseEnv();

    if (!env) {
        return NextResponse.next();
    }

    let response = NextResponse.next({ request });
    const supabase = createServerClient(env.url, env.key, {
        cookies: {
            getAll() {
                return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                response = NextResponse.next({ request });
                cookiesToSet.forEach(({ name, value, options }) => {
                    response.cookies.set(name, value, options);
                });
            },
        },
    });

    const {
        data: { user },
    } = await supabase.auth.getUser();
    const isPublicRoute =
        request.nextUrl.pathname.startsWith('/login') ||
        request.nextUrl.pathname.startsWith('/auth') ||
        request.nextUrl.pathname.startsWith('/share/') ||
        request.nextUrl.pathname.startsWith('/invite/');

    if (!user && !isPublicRoute) {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        url.search = '';
        url.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search);
        const target = NextResponse.redirect(url);
        response.cookies.getAll().forEach((c) => target.cookies.set(c));
        return target;
    }

    if (user && request.nextUrl.pathname === '/login') {
        const target = NextResponse.redirect(
            new URL(safeReturnPath(request.nextUrl.searchParams.get('next')), request.url),
        );
        response.cookies.getAll().forEach((c) => target.cookies.set(c));
        return target;
    }

    return response;
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|icons/|fonts/).*)',
    ],
};
