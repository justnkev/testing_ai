import { getCustomers } from '@/lib/actions/customers';
import { CustomerDrawer } from '@/components/customer-drawer';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Phone, Mail, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default async function CustomersPage() {
    const result = await getCustomers();
    const customers = result.data;

    return (
        <div className="p-4 md:p-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard">
                        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-700">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-white">Customers</h1>
                        <p className="text-slate-400 mt-1">Manage your customer database</p>
                    </div>
                </div>
                <CustomerDrawer />
            </div>

            {/* Customer Count */}
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 inline-block">
                <p className="text-sm text-slate-400">Total Customers</p>
                <p className="text-2xl font-bold text-white">{customers.length}</p>
            </div>

            {/* Empty State */}
            {customers.length === 0 && (
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 text-center">
                    <div className="w-16 h-16 mx-auto bg-slate-700 rounded-full flex items-center justify-center mb-4">
                        <MapPin className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">No customers yet</h3>
                    <p className="text-slate-400 mb-4">Add your first customer to get started.</p>
                </div>
            )}

            {/* Customer Grid */}
            {customers.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {customers.map((customer) => {
                        const fullAddress = [customer.address, customer.city, customer.state, customer.zip_code]
                            .filter(Boolean)
                            .join(', ');
                        const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;

                        return (
                            <Card key={customer.id} className="bg-slate-800 border-slate-700">
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between mb-3">
                                        <h3 className="font-semibold text-white">{customer.name}</h3>
                                        <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
                                            Active
                                        </Badge>
                                    </div>

                                    <div className="space-y-2">
                                        <a
                                            href={mapUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-start gap-2 text-sm text-slate-400 hover:text-blue-400 transition-colors"
                                        >
                                            <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                            <span className="line-clamp-2">{fullAddress}</span>
                                        </a>

                                        {customer.phone && (
                                            <a
                                                href={`tel:${customer.phone}`}
                                                className="flex items-center gap-2 text-sm text-slate-400 hover:text-blue-400 transition-colors"
                                            >
                                                <Phone className="w-4 h-4 flex-shrink-0" />
                                                <span>{customer.phone}</span>
                                            </a>
                                        )}

                                        {customer.email && (
                                            <a
                                                href={`mailto:${customer.email}`}
                                                className="flex items-center gap-2 text-sm text-slate-400 hover:text-blue-400 transition-colors"
                                            >
                                                <Mail className="w-4 h-4 flex-shrink-0" />
                                                <span className="truncate">{customer.email}</span>
                                            </a>
                                        )}
                                    </div>

                                    {customer.notes && (
                                        <p className="mt-3 text-sm text-slate-500 italic line-clamp-2">
                                            {customer.notes}
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
