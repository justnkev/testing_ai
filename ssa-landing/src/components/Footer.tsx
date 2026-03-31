import Image from "next/image";
import ArrowMotif from "@/components/ArrowMotif";

export default function Footer() {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="relative border-t border-brand-border bg-white overflow-hidden">
            {/* Arrow divider */}
            <div className="flex justify-center -mt-px">
                <ArrowMotif className="w-16 h-16 -mt-6" opacity={0.12} />
            </div>

            <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
                <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                    {/* Logo + company */}
                    <div className="flex flex-col items-center md:items-start gap-3">
                        <Image
                            src="/abbrv_logo.png"
                            alt="Singularity Service Acquisitions"
                            width={120}
                            height={40}
                            className="h-8 w-auto object-contain opacity-70"
                        />
                        <p className="text-sm text-brand-muted">
                            Singularity Service Acquisitions LLC
                        </p>
                    </div>

                    {/* Links */}
                    <div className="flex items-center gap-8 text-sm text-brand-muted">
                        <a href="#hero" className="hover:text-brand-accent transition-colors">
                            Home
                        </a>
                        <a href="#mor" className="hover:text-brand-accent transition-colors">
                            Our Focus
                        </a>
                        <a href="#criteria" className="hover:text-brand-accent transition-colors">
                            Criteria
                        </a>
                        <a href="#contact" className="hover:text-brand-accent transition-colors">
                            Contact
                        </a>
                    </div>
                </div>

                {/* Bottom bar */}
                <div className="mt-10 pt-6 border-t border-brand-border flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-brand-muted">
                    <p>
                        © {currentYear} Singularity Service Acquisitions LLC. All rights
                        reserved.
                    </p>
                    <p>Connecticut, USA</p>
                </div>
            </div>
        </footer>
    );
}
