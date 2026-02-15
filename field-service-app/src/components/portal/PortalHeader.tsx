import Link from 'next/link';
import { Phone, Mail } from 'lucide-react';

interface PortalHeaderProps {
    businessName: string;
    logoUrl?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    customerName?: string;
}

export function PortalHeader({
    businessName,
    logoUrl,
    contactEmail,
    contactPhone,
    customerName,
}: PortalHeaderProps) {
    return (
        <header className="bg-white border-b border-slate-200 shadow-sm">
            <div className="max-w-6xl mx-auto px-4 py-4">
                <div className="flex items-center justify-between">
                    {/* Business Logo/Name */}
                    <div className="flex items-center gap-3">
                        {logoUrl ? (
                            <img
                                src={logoUrl}
                                alt={businessName}
                                className="h-10 w-auto"
                            />
                        ) : (
                            <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-xl">
                                    {businessName.charAt(0)}
                                </span>
                            </div>
                        )}
                        <h1 className="text-xl font-bold text-slate-900">{businessName}</h1>
                    </div>

                    {/* Customer Info & Contact */}
                    <div className="flex items-center gap-4">
                        {customerName && (
                            <span className="text-sm text-slate-600 hidden sm:block">
                                Welcome, <strong>{customerName}</strong>
                            </span>
                        )}

                        {(contactEmail || contactPhone) && (
                            <div className="flex items-center gap-3 text-sm text-slate-600">
                                {contactPhone && (
                                    <a
                                        href={`tel:${contactPhone}`}
                                        className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                                    >
                                        <Phone className="w-4 h-4" />
                                        <span className="hidden sm:inline">{contactPhone}</span>
                                    </a>
                                )}
                                {contactEmail && (
                                    <a
                                        href={`mailto:${contactEmail}`}
                                        className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                                    >
                                        <Mail className="w-4 h-4" />
                                        <span className="hidden sm:inline">{contactEmail}</span>
                                    </a>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
