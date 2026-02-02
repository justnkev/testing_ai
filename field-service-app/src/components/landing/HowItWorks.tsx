'use client';

import { motion } from 'framer-motion';

const steps = [
    {
        number: "01",
        title: "Create a Job",
        description: "Enter customer details and schedule the work in seconds."
    },
    {
        number: "02",
        title: "Dispatch Tech",
        description: "Technician gets a notification and drives to the location."
    },
    {
        number: "03",
        title: "Get Paid",
        description: "Job done. Invoice sent. Payment collected instantly."
    },
];

export function HowItWorks() {
    return (
        <section id="how-it-works" className="py-24 bg-white">
            <div className="container mx-auto px-4">
                <div className="mb-16 md:text-center max-w-3xl mx-auto">
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                        From Request to Revenue
                    </h2>
                    <p className="mt-4 text-lg text-slate-600">
                        A seamless workflow designed to eliminate paperwork and get you paid faster.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
                    {/* Connector Line (Desktop) */}
                    <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 bg-slate-100 -z-10" />

                    {steps.map((step, index) => (
                        <motion.div
                            key={step.number}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.2, duration: 0.5 }}
                            viewport={{ once: true }}
                            className="relative bg-white pt-4 md:text-center"
                        >
                            <div className="text-6xl font-black text-slate-100 mb-4 select-none">
                                {step.number}
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2 relative z-10">
                                {step.title}
                            </h3>
                            <p className="text-slate-600 relative z-10 max-w-sm mx-auto">
                                {step.description}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
