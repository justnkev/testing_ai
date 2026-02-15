import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { createClient } from '@/lib/supabase/server';

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Handle portal routes with inline token validation (Edge Runtime compatible)
    if (pathname.startsWith('/portal/')) {
        const pathParts = pathname.split('/');
        const token = pathParts[2]; // /portal/[token]/...

        // Skip validation for the expired page  
        if (pathname === '/portal/expired') {
            return NextResponse.next();
        }

        // Simple token validation for middleware (full validation happens in page server components)
        if (token && token !== 'expired' && token.length > 10) {
            //Token looks valid, let it through - full validation in page components
            const response = NextResponse.next();
            return response;
        } else if (token) {
            // Invalid token format, redirect to expired
            const url = request.nextUrl.clone();
            url.pathname = '/portal/expired';
            return NextResponse.redirect(url);
        }
    }

    // For all other routes, use standard session update
    return await updateSession(request);
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
