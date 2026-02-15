'use client';

import { Card } from '@/components/ui/card';
import {
    Calendar,
    CreditCard,
    Smartphone,
    Users,
    BarChart3,
    Map as MapIcon,
    Package,
    Megaphone,
    FileText
} from 'lucide-react';
import { motion } from 'framer-motion';

const features = [
    {
        title: "Mobile Technician View",
        description: "Empower your team with a complete office in their pocket. View jobs, track time, and collect signatures.",
        icon: Smartphone,
        className: "md:col-span-2",
    },
    {
        title: "Real-time Scheduling",
        description: "Drag-and-drop dispatching that instantly syncs across all devices.",
        icon: Calendar,
        className: "md:col-span-1",
    },
    {
        title: "Inventory Management",
        description: "Track parts, equipment, and stock levels in real-time across your warehouses and vehicles.",
        icon: Package,
        className: "md:col-span-1",
    },
    {
        title: "Stripe Payments & Invoicing",
        description: "Create professional invoices and accept credit card payments in the field.",
        icon: CreditCard,
        className: "md:col-span-2",
    },
    {
        title: "Advanced Analytics",
        description: "Gain insights into your business performance with detailed reports on revenue, job completion, and technician efficiency.",
        icon: BarChart3,
        className: "md:col-span-2",
    },
    {
        title: "Map View",
        description: "Visualize technician locations and job sites on an interactive map for efficient routing.",
        icon: MapIcon,
        className: "md:col-span-1",
    },
    {
        title: "Smart Quoting",
        description: "Generate beautiful estimates that turn into jobs with one click.",
        icon: FileText,
        className: "md:col-span-1",
    },
    {
        title: "Marketing & CRM",
        description: "Broadcast SMS/Email campaigns and manage customer relationships to drive repeat business.",
        icon: Megaphone,
        className: "md:col-span-1",
    },
];

export function FeatureGrid() {
    return (
        <section id="features" className="py-24 bg-slate-50">
            <div className="container mx-auto px-4">
                <div className="text-center max-w-2xl mx-auto mb-16">
                    <h2 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                        Everything you need to run your business
                    </h2>
                    <p className="mt-4 text-lg text-slate-600">
                        Purpose-built tools for the modern service business. Simple enough for beginners, powerful enough for pros.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {features.map((feature, index) => (
                        <motion.div
                            key={feature.title}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05, duration: 0.5 }}
                            viewport={{ once: true }}
                            className={feature.className}
                        >
                            <Card className="h-full p-8 border-slate-200 shadow-sm hover:shadow-md transition-shadow group overflow-hidden relative">
                                <div className="relative z-10">
                                    <div className="h-12 w-12 rounded-lg bg-slate-100 flex items-center justify-center mb-6 text-slate-900 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                                        <feature.icon className="h-6 w-6" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 mb-3 ml-0">{feature.title}</h3>
                                    <p className="text-slate-600">{feature.description}</p>
                                </div>
                                {/* Decoration */}
                                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-slate-50 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                            </Card>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
