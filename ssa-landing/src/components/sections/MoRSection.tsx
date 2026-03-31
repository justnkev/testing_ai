import { Shield, ArrowUpRight, UserCheck, Clock } from "lucide-react";

const benefits = [
    {
        icon: Shield,
        title: "License Preservation",
        description:
            "We ensure the Master of Record license transfers seamlessly, protecting your company's ability to operate without disruption.",
    },
    {
        icon: UserCheck,
        title: "Successor Planning",
        description:
            "SSA identifies and develops qualified successors for the MoR role — so your business never faces a licensing gap.",
    },
    {
        icon: Clock,
        title: "Longevity Commitment",
        description:
            "We don't strip and flip. Our model is built on long-term stewardship of the businesses we acquire.",
    },
];

export default function MoRSection() {
    return (
        <section id="mor" className="py-24 md:py-32">
            <div className="mx-auto max-w-6xl px-6">
                {/* Section header */}
                <div className="max-w-2xl mb-16">
                    <p className="text-sm font-semibold uppercase tracking-wider text-brand-accent mb-3">
                        Our Commitment
                    </p>
                    <h2 className="text-3xl sm:text-4xl font-bold text-brand-text">
                        The Master of Record Is{" "}
                        <span className="text-brand-accent">Your Greatest Asset.</span>
                    </h2>
                    <p className="mt-4 text-lg text-brand-muted leading-relaxed">
                        In electrical contracting, the Master of Record (MoR) license is
                        the foundation of every permit, inspection, and project. We
                        understand this isn&apos;t just paperwork — it&apos;s the lifeblood
                        of your business.
                    </p>
                </div>

                {/* MoR Callout Card */}
                <div className="relative rounded-2xl border-l-4 border-brand-accent bg-white p-8 md:p-10 shadow-sm mb-12">
                    <div className="flex items-start gap-4">
                        <div className="shrink-0 flex items-center justify-center w-12 h-12 rounded-xl bg-brand-accent/10">
                            <ArrowUpRight className="w-6 h-6 text-brand-accent" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-brand-text mb-2">
                                Why This Matters to Owners
                            </h3>
                            <p className="text-brand-muted leading-relaxed">
                                Many acquisition firms overlook the complexity of MoR
                                succession. Without a qualified successor, your company could
                                lose its license — and with it, the ability to operate. SSA
                                makes MoR transition planning a{" "}
                                <strong className="text-brand-text font-semibold">
                                    core part of every deal
                                </strong>
                                , not an afterthought.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Benefits grid */}
                <div className="grid md:grid-cols-3 gap-6">
                    {benefits.map((item) => (
                        <div
                            key={item.title}
                            className="group rounded-2xl bg-white border border-brand-border p-8 transition-all duration-300 hover:border-brand-accent hover:shadow-lg hover:shadow-brand-accent/5 hover:-translate-y-1"
                        >
                            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-brand-accent/10 mb-6 group-hover:bg-brand-accent/15 transition-colors">
                                <item.icon className="w-6 h-6 text-brand-accent" />
                            </div>
                            <h3 className="text-lg font-bold text-brand-text mb-2">
                                {item.title}
                            </h3>
                            <p className="text-brand-muted text-sm leading-relaxed">
                                {item.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
