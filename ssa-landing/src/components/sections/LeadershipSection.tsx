import Image from "next/image";
import { GraduationCap, Briefcase, Heart } from "lucide-react";

export default function LeadershipSection() {
    return (
        <section id="leadership" className="py-24 md:py-32 bg-white relative overflow-hidden">
            {/* Subtle background accent */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-brand-accent/[0.03] rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-brand-accent/[0.03] rounded-full blur-3xl" />
            </div>

            <div className="mx-auto max-w-6xl px-6 relative z-10">
                {/* Section header */}
                <div className="text-center max-w-2xl mx-auto mb-16">
                    <p className="text-sm font-semibold uppercase tracking-wider text-brand-accent mb-3">
                        Leadership
                    </p>
                    <h2 className="text-3xl sm:text-4xl font-bold text-brand-text">
                        Meet the{" "}
                        <span className="text-brand-accent">Managing Partner</span>
                    </h2>
                </div>

                {/* Bio card */}
                <div className="grid lg:grid-cols-5 gap-10 lg:gap-14 items-start">
                    {/* Photo column */}
                    <div className="lg:col-span-2 flex flex-col items-center lg:items-start">
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-br from-brand-accent/20 to-brand-accent/5 rounded-2xl blur-sm group-hover:blur-md transition-all duration-500" />
                            <div className="relative overflow-hidden rounded-2xl border border-brand-border shadow-lg">
                                <Image
                                    src="/kevin_wong.png"
                                    alt="Kevin Wong — Managing Partner"
                                    width={480}
                                    height={600}
                                    className="w-full h-auto object-cover"
                                    priority
                                />
                            </div>
                        </div>
                        <div className="mt-6 text-center lg:text-left">
                            <h3 className="text-2xl font-bold text-brand-text">
                                Kevin Wong
                            </h3>
                            <p className="text-brand-accent font-semibold mt-1">
                                Managing Partner
                            </p>
                        </div>

                        {/* Credential badges */}
                        <div className="flex flex-wrap gap-3 mt-5 justify-center lg:justify-start">
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-muted bg-brand-bg border border-brand-border rounded-full px-3 py-1.5">
                                <GraduationCap className="w-3.5 h-3.5 text-brand-accent" />
                                NYU Stern
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-muted bg-brand-bg border border-brand-border rounded-full px-3 py-1.5">
                                <Briefcase className="w-3.5 h-3.5 text-brand-accent" />
                                PE &amp; Fortune 500
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-muted bg-brand-bg border border-brand-border rounded-full px-3 py-1.5">
                                <Heart className="w-3.5 h-3.5 text-brand-accent" />
                                Connecticut Native
                            </span>
                        </div>
                    </div>

                    {/* Bio text column */}
                    <div className="lg:col-span-3 space-y-6">
                        <p className="text-lg text-brand-muted leading-relaxed">
                            Kevin brings a unique blend of operational expertise and a
                            deep-rooted respect for small business ownership. Born and
                            raised in Connecticut, he maintains a strong personal
                            attachment to the region and is deeply committed to
                            preserving the legacy of Tri-State area businesses.
                        </p>
                        <p className="text-lg text-brand-muted leading-relaxed">
                            Prior to founding the firm, Kevin built a career driving
                            strategic transformation, operational efficiency, and M&amp;A
                            integration for private equity-backed enterprises, Fortune
                            500 companies, and high-growth startups in New York City. He
                            holds a Bachelor of Science in Business with a focus on
                            Finance and Operations from New York University&apos;s Stern
                            School of Business.
                        </p>

                        {/* Divider with accent */}
                        <div className="flex items-center gap-4 py-2">
                            <div className="h-px flex-1 bg-brand-border" />
                            <span className="text-brand-accent text-xs font-semibold uppercase tracking-widest">
                                Why This Matters
                            </span>
                            <div className="h-px flex-1 bg-brand-border" />
                        </div>

                        <p className="text-lg text-brand-muted leading-relaxed">
                            For Kevin, acquiring and operating a small business is
                            deeply personal. Growing up, he watched his father pour his
                            life into building a successful local practice. When a
                            sudden health scare forced his father into an abrupt early
                            retirement and a rushed sale, Kevin witnessed firsthand the
                            emotional and logistical toll of an unplanned exit. He saw
                            how much blood, sweat, and tears go into building a company,
                            and how vulnerable that legacy is at the finish line.
                        </p>
                        <p className="text-lg text-brand-muted leading-relaxed">
                            Kevin launched this firm to offer retiring founders a better
                            option. He is committed to providing a graceful, transparent
                            transition for owners ready to step back, ensuring their
                            legacy is protected, their employees are valued, and their
                            business continues to thrive for the next generation in the
                            community it serves.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}
