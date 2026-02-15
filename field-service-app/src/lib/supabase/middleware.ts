import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({
                        request,
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // IMPORTANT: Avoid writing any logic between createServerClient and
    // supabase.auth.getUser(). A simple mistake could make your app insecure.
    const {
        data: { user },
    } = await supabase.auth.getUser();

    // Protected routes - redirect to login if not authenticated
    if (
        !user &&
        (request.nextUrl.pathname.startsWith('/dashboard') ||
            request.nextUrl.pathname === '/auth/set-new-password')
    ) {
        // For set-new-password, the user needs a valid recovery/invite session
        // If they don't have one, show the expired state rather than login
        if (request.nextUrl.pathname === '/auth/set-new-password') {
            // Let them through — the page itself will render the expired UI
            // because getUser() will return null
        } else {
            const url = request.nextUrl.clone();
            url.pathname = '/login';
            return NextResponse.redirect(url);
        }
    }

    // Onboarding Check
    if (
        user &&
        !user.user_metadata?.onboarding_complete &&
        !request.nextUrl.pathname.startsWith('/complete-onboarding') &&
        !request.nextUrl.pathname.startsWith('/auth') &&
        !request.nextUrl.pathname.startsWith('/portal') // Allow portal access if needed, though usually different users
    ) {
        const url = request.nextUrl.clone();
        url.pathname = '/complete-onboarding';
        return NextResponse.redirect(url);
    }

    // Role-based access control
    if (user && request.nextUrl.pathname.startsWith('/dashboard')) {
        // Fetch user role
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        const role = profile?.role;

        // Technician Restrictions
        if (role === 'technician') {
            const restrictedRoutes = ['/dashboard/analytics'];
            if (restrictedRoutes.some(route => request.nextUrl.pathname.startsWith(route))) {
                const url = request.nextUrl.clone();
                url.pathname = '/dashboard';
                url.searchParams.set('error', 'access_denied');
                return NextResponse.redirect(url);
            }
        }
    }

    // Redirect authenticated users away from login and reset-password pages
    if (
        user &&
        (request.nextUrl.pathname === '/login' ||
            request.nextUrl.pathname === '/auth/reset-password')
    ) {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard';
        return NextResponse.redirect(url);
    }

    return supabaseResponse;
}
