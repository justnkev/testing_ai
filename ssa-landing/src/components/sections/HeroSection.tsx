import ArrowMotif from "@/components/ArrowMotif";

export default function HeroSection() {
    return (
        <section
            id="hero"
            className="relative min-h-screen flex items-center overflow-hidden"
        >
            {/* Arrow watermark */}
            <ArrowMotif
                className="absolute right-[-5%] top-[10%] w-[500px] h-[500px] hidden md:block"
                opacity={0.035}
            />
            <ArrowMotif
                className="absolute left-[-8%] bottom-[5%] w-[300px] h-[300px] rotate-12"
                opacity={0.02}
            />

            <div className="mx-auto max-w-6xl px-6 pt-32 pb-20 md:pt-40 md:pb-28">
                <div className="max-w-3xl">
                    {/* Eyebrow */}
                    <div className="inline-flex items-center gap-2 rounded-full border border-brand-border bg-white px-4 py-1.5 mb-8">
                        <span className="h-2 w-2 rounded-full bg-brand-accent animate-pulse" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-brand-muted">
                            Actively Seeking Partners
                        </span>
                    </div>

                    {/* Headline */}
                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-brand-text leading-[1.08] tracking-tight">
                        Partnering with the{" "}
                        <span className="text-brand-accent">Tri-State&apos;s</span>{" "}
                        Premier Electrical Firms.
                    </h1>

                    {/* Sub-headline */}
                    <p className="mt-6 text-lg sm:text-xl text-brand-muted leading-relaxed max-w-2xl">
                        Singularity Service Acquisitions acquires and operates
                        established electrical contracting businesses — preserving
                        legacies, empowering teams, and unlocking growth.
                    </p>

                    {/* CTA */}
                    <div className="mt-10 flex flex-wrap gap-4">
                        <a
                            href="#contact"
                            className="inline-flex items-center justify-center rounded-xl bg-brand-accent px-8 py-4 text-base font-semibold text-white shadow-lg shadow-brand-accent/25 hover:bg-brand-accent-hover hover:shadow-xl hover:shadow-brand-accent/30 transition-all duration-300 hover:-translate-y-0.5"
                        >
                            Start a Conversation
                        </a>
                        <a
                            href="#criteria"
                            className="inline-flex items-center justify-center rounded-xl border-2 border-brand-border bg-white px-8 py-4 text-base font-semibold text-brand-text hover:border-brand-accent hover:text-brand-accent transition-all duration-300"
                        >
                            View Our Criteria
                        </a>
                    </div>
                </div>
            </div>

            {/* Bottom fade */}
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-brand-bg to-transparent" />
        </section>
    );
}
