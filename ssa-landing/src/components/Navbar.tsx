"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const navLinks = [
    { label: "About", href: "#about" },
    { label: "Our Focus", href: "#mor" },
    { label: "Criteria", href: "#criteria" },
    { label: "Contact", href: "#contact" },
];

export default function Navbar() {
    const [scrolled, setScrolled] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <header
            className={cn(
                "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
                scrolled
                    ? "bg-white/80 backdrop-blur-lg shadow-sm border-b border-brand-border"
                    : "bg-transparent"
            )}
        >
            <nav className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
                {/* Logo */}
                <a href="#hero" className="flex items-center gap-3 shrink-0" aria-label="Back to top">
                    <Image
                        src="/abbrv_logo.png"
                        alt="Singularity Service Acquisitions"
                        width={140}
                        height={50}
                        priority
                        className="h-10 w-auto object-contain"
                    />
                </a>

                {/* Desktop nav */}
                <ul className="hidden md:flex items-center gap-8">
                    {navLinks.map((link) => (
                        <li key={link.href}>
                            <a
                                href={link.href}
                                className="text-sm font-medium text-brand-text/70 hover:text-brand-accent transition-colors duration-200"
                            >
                                {link.label}
                            </a>
                        </li>
                    ))}
                    <li>
                        <a
                            href="#contact"
                            className="inline-flex items-center justify-center rounded-lg bg-brand-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-accent-hover transition-colors duration-200"
                        >
                            Get in Touch
                        </a>
                    </li>
                </ul>

                {/* Mobile hamburger */}
                <button
                    className="md:hidden p-2 text-brand-text"
                    onClick={() => setMenuOpen(!menuOpen)}
                    aria-label={menuOpen ? "Close menu" : "Open menu"}
                >
                    {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
            </nav>

            {/* Mobile menu */}
            <div
                className={cn(
                    "md:hidden overflow-hidden transition-all duration-300 bg-white/95 backdrop-blur-lg border-b border-brand-border",
                    menuOpen ? "max-h-80 opacity-100" : "max-h-0 opacity-0"
                )}
            >
                <ul className="flex flex-col gap-1 px-6 py-4">
                    {navLinks.map((link) => (
                        <li key={link.href}>
                            <a
                                href={link.href}
                                onClick={() => setMenuOpen(false)}
                                className="block py-3 text-base font-medium text-brand-text/80 hover:text-brand-accent transition-colors"
                            >
                                {link.label}
                            </a>
                        </li>
                    ))}
                    <li className="pt-2">
                        <a
                            href="#contact"
                            onClick={() => setMenuOpen(false)}
                            className="block w-full text-center rounded-lg bg-brand-accent px-5 py-3 text-sm font-semibold text-white hover:bg-brand-accent-hover transition-colors"
                        >
                            Get in Touch
                        </a>
                    </li>
                </ul>
            </div>
        </header>
    );
}
