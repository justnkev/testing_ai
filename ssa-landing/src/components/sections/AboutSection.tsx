import { Handshake, Building2, Users } from "lucide-react";

const values = [
    {
        icon: Handshake,
        title: "Legacy Preservation",
        description:
            "Your name, your reputation, your team — we honor what you've built over decades of hard work.",
    },
    {
        icon: Building2,
        title: "Operational Continuity",
        description:
            "We don't restructure for the sake of it. Proven systems stay in place while we add resources to grow.",
    },
    {
        icon: Users,
        title: "Owner-Friendly Terms",
        description:
            "Flexible structures, fair valuations, and a respectful timeline. Your transition, your way.",
    },
];

export default function AboutSection() {
    return (
        <section id="about" className="py-24 md:py-32 bg-white">
            <div className="mx-auto max-w-6xl px-6">
                {/* Section header */}
                <div className="text-center max-w-2xl mx-auto mb-16">
                    <p className="text-sm font-semibold uppercase tracking-wider text-brand-accent mb-3">
                        Who We Are
                    </p>
                    <h2 className="text-3xl sm:text-4xl font-bold text-brand-text">
                        Built for Business Owners,{" "}
                        <span className="text-brand-accent">By Operators.</span>
                    </h2>
                    <p className="mt-4 text-lg text-brand-muted leading-relaxed">
                        Singularity Service Acquisitions is a Connecticut-based search fund
                        focused exclusively on acquiring and operating premium electrical
                        contracting businesses in the Tri-State area.
                    </p>
                </div>

                {/* Values grid */}
                <div className="grid md:grid-cols-3 gap-6">
                    {values.map((item) => (
                        <div
                            key={item.title}
                            className="group text-center rounded-2xl bg-brand-bg border border-brand-border p-8 md:p-10 transition-all duration-300 hover:border-brand-accent hover:shadow-lg hover:shadow-brand-accent/5 hover:-translate-y-1"
                        >
                            <div className="mx-auto flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-accent/10 mb-6 group-hover:bg-brand-accent/15 transition-colors">
                                <item.icon className="w-7 h-7 text-brand-accent" />
                            </div>
                            <h3 className="text-lg font-bold text-brand-text mb-3">
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
