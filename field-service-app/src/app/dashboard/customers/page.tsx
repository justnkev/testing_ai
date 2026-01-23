export const dynamic = 'force-dynamic';

import { getCustomers } from '@/lib/actions/customers';
import { CustomerDrawer } from '@/components/customer-drawer';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Phone, Mail, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CustomerList } from '@/components/customer-list';

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

            {/* Customer List */}
            <CustomerList initialCustomers={customers} />
        </div>
    );
}
