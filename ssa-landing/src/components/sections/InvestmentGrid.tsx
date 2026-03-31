import { DollarSign, TrendingUp, MapPin, Zap } from "lucide-react";
import ArrowMotif from "@/components/ArrowMotif";

const criteria = [
    {
        icon: DollarSign,
        label: "Revenue",
        value: "$2M – $5M",
        description: "Established businesses with proven, stable revenue streams.",
    },
    {
        icon: TrendingUp,
        label: "Seller's Discretionary Earnings",
        value: "$750K – $2M",
        description: "Strong cash-flow generation with healthy margins.",
    },
    {
        icon: MapPin,
        label: "Geography",
        value: "NY Tri-State",
        description: "Connecticut, New York, and New Jersey metropolitan area.",
    },
    {
        icon: Zap,
        label: "Industry",
        value: "Electrical Contracting",
        description: "Residential, commercial, and industrial electrical services.",
    },
];

export default function InvestmentGrid() {
    return (
        <section id="criteria" className="relative py-24 md:py-32 bg-brand-text overflow-hidden">
            {/* Arrow watermark on dark */}
            <ArrowMotif
                className="absolute right-[5%] top-[10%] w-[400px] h-[400px]"
                opacity={0.04}
            />

            <div className="mx-auto max-w-6xl px-6 relative z-10">
                {/* Section header */}
                <div className="text-center max-w-2xl mx-auto mb-16">
                    <p className="text-sm font-semibold uppercase tracking-wider text-brand-accent mb-3">
                        Investment Criteria
                    </p>
                    <h2 className="text-3xl sm:text-4xl font-bold text-white">
                        What We Look For
                    </h2>
                    <p className="mt-4 text-lg text-gray-400 leading-relaxed">
                        We focus on established, cash-flowing electrical contracting firms
                        in the Tri-State area that are ready for their next chapter.
                    </p>
                </div>

                {/* 2×2 Grid */}
                <div className="grid sm:grid-cols-2 gap-6">
                    {criteria.map((item) => (
                        <div
                            key={item.label}
                            className="group relative rounded-2xl border border-gray-700 bg-gray-900/50 p-8 md:p-10 backdrop-blur-sm transition-all duration-300 hover:border-brand-accent hover:bg-gray-900/80 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-accent/10"
                        >
                            {/* Icon */}
                            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-brand-accent/15 mb-6 group-hover:bg-brand-accent/25 transition-colors">
                                <item.icon className="w-6 h-6 text-brand-accent" />
                            </div>

                            {/* Label */}
                            <p className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-1">
                                {item.label}
                            </p>

                            {/* Value */}
                            <p className="text-2xl md:text-3xl font-bold text-white mb-3">
                                {item.value}
                            </p>

                            {/* Description */}
                            <p className="text-gray-400 text-sm leading-relaxed">
                                {item.description}
                            </p>

                            {/* Hover accent line */}
                            <div className="absolute bottom-0 left-8 right-8 h-0.5 bg-brand-accent rounded-full scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
