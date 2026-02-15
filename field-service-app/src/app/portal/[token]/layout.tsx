import { createClient } from '@/lib/supabase/server';

export async function getBusinessSettings() {
    const supabase = await createClient();

    const { data } = await supabase
        .from('business_settings')
        .select('*')
        .single();

    return data || {
        business_name: 'Field Service Co.',
        logo_url: null,
        primary_color: '#3B82F6',
        secondary_color: '#8B5CF6',
        contact_email: null,
        contact_phone: null,
    };
}

export default async function PortalLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ token: string }>;
}) {
    const { token } = await params;
    const settings = await getBusinessSettings();

    return (
        <html lang="en">
            <head>
                {/* SEO: Noindex for customer portal */}
                <meta name="robots" content="noindex, nofollow" />
            </head>
            <body>
                <div
                    className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100"
                    style={{
                        ['--portal-primary' as any]: settings.primary_color,
                        ['--portal-secondary' as any]: settings.secondary_color,
                    }}
                >
                    {children}
                </div>
            </body>
        </html>
    );
}
