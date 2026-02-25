import { CheckCircle2 } from "lucide-react";

/**
 * Replace the placeholder URL below with your actual Google Form embed URL.
 * To get it: Google Form → Send → Embed (<>) → copy the src URL.
 */
const GOOGLE_FORM_URL =
    "https://forms.gle/Y4bKXaPxEqJReP569";

export default function ContactSection() {
    return (
        <section id="contact" className="py-24 md:py-32">
            <div className="mx-auto max-w-6xl px-6">
                <div className="grid lg:grid-cols-2 gap-16 items-start">
                    {/* Left copy */}
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-wider text-brand-accent mb-3">
                            Let&apos;s Connect
                        </p>
                        <h2 className="text-3xl sm:text-4xl font-bold text-brand-text mb-6">
                            Ready to Explore{" "}
                            <span className="text-brand-accent">Your Options?</span>
                        </h2>
                        <p className="text-lg text-brand-muted leading-relaxed mb-8">
                            Whether you&apos;re considering selling, planning for retirement,
                            or simply want to understand your company&apos;s value — we&apos;d
                            love to have a confidential conversation.
                        </p>
                        <div className="space-y-4 text-brand-muted text-sm">
                            <div className="flex items-center gap-3">
                                <CheckCircle2 className="w-5 h-5 text-brand-accent shrink-0" />
                                <span>No obligation, fully confidential</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <CheckCircle2 className="w-5 h-5 text-brand-accent shrink-0" />
                                <span>Respond within 24 business hours</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <CheckCircle2 className="w-5 h-5 text-brand-accent shrink-0" />
                                <span>Flexible deal structures tailored to you</span>
                            </div>
                        </div>
                    </div>

                    {/* Right — Google Form embed */}
                    <div className="rounded-2xl bg-white border border-brand-border shadow-sm overflow-hidden">
                        <iframe
                            src={GOOGLE_FORM_URL}
                            width="100%"
                            height="700"
                            title="Contact Form"
                            className="border-0 w-full"
                            loading="lazy"
                        >
                            Loading…
                        </iframe>
                    </div>
                </div>
            </div>
        </section>
    );
}
