'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';

export function Header() {
    const [user, setUser] = useState<User | null>(null);
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const supabase = createClient();

        // Check initial session
        supabase.auth.getUser().then(({ data: { user } }) => {
            setUser(user);
        });

        // Handle scroll for sticky effect
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 10);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <header
            className={`fixed top-0 w-full z-50 transition-all duration-300 ${isScrolled
                ? 'bg-white/80 backdrop-blur-md border-b border-slate-200'
                : 'bg-transparent'
                }`}
        >
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                <Link href="/" className="flex items-center space-x-2">
                    <div className="size-8 rounded-lg bg-slate-900 flex items-center justify-center">
                        <span className="text-white font-bold">F</span>
                    </div>
                    <span className="font-bold text-lg tracking-tight text-slate-900">Field Service Pro</span>
                </Link>

                {/* Desktop Navigation */}
                <nav className="hidden md:flex items-center space-x-8">
                    <Link href="#features" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                        Features
                    </Link>
                    <Link href="#how-it-works" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                        How it Works
                    </Link>
                    <Link href="#pricing" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                        Pricing
                    </Link>
                </nav>

                <div className="flex items-center space-x-4">
                    {user ? (
                        <Link href="/dashboard">
                            <Button size="sm" className="font-semibold">
                                Go to Dashboard
                            </Button>
                        </Link>
                    ) : (
                        <>
                            <Link href="/login" className="hidden md:block">
                                <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900">
                                    Log in
                                </Button>
                            </Link>
                            <Link href="/login">
                                <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800">
                                    Get Started
                                </Button>
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}
