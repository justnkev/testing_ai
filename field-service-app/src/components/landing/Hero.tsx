'use client';

import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export function Hero() {
    return (
        <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
            {/* Background Gradients/Grid */}
            <div className="absolute inset-0 -z-10 h-full w-full bg-white bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]">
                <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-slate-400 opacity-20 blur-[100px]" />
            </div>

            <div className="container mx-auto px-4 text-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="mx-auto max-w-3xl"
                >
                    <div className="mb-6 flex justify-center">
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-600 backdrop-blur-sm">
                            <span className="mr-2 flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            New: AI-Powered Scheduling
                        </span>
                    </div>

                    <h1 className="mb-8 text-4xl font-extrabold tracking-tight text-slate-950 sm:text-6xl md:text-7xl">
                        Field Service Management <br className="hidden sm:block" />
                        <span className="text-slate-600">Reimagined.</span>
                    </h1>

                    <p className="mb-10 text-lg text-slate-600 sm:text-xl md:max-w-2xl mx-auto leading-relaxed">
                        Streamline your operations with the most intuitive platform for field service teams.
                        Schedule jobs, track technicians, and get paid faster.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
                        <Link href="/login">
                            <Button size="lg" className="h-12 px-8 text-base bg-slate-950 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/10">
                                Start Free Trial
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </Link>
                        <Link href="#features">
                            <Button variant="outline" size="lg" className="h-12 px-8 text-base border-slate-200 text-slate-700 hover:bg-slate-50">
                                View Interactions
                            </Button>
                        </Link>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-sm text-slate-500">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-slate-900" />
                            <span>14-day free trial</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-slate-900" />
                            <span>No credit card required</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-slate-900" />
                            <span>Cancel anytime</span>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
