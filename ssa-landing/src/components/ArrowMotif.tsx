"use client";

import { cn } from "@/lib/utils";

interface ArrowMotifProps {
    className?: string;
    opacity?: number;
}

/**
 * SVG arrow motif inspired by the SSA logo — a geometric upward arrow
 * with layered chevrons. Used as watermark and section divider.
 */
export default function ArrowMotif({ className, opacity = 0.04 }: ArrowMotifProps) {
    return (
        <svg
            viewBox="0 0 200 180"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={cn("pointer-events-none select-none", className)}
            style={{ opacity }}
            aria-hidden="true"
        >
            {/* Back chevron (darkest) */}
            <polyline
                points="30,140 100,60 170,140"
                stroke="#1E293B"
                strokeWidth="12"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
            />
            {/* Middle chevron */}
            <polyline
                points="50,150 100,90 150,150"
                stroke="#64748B"
                strokeWidth="10"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
            />
            {/* Arrow shaft */}
            <line
                x1="100"
                y1="30"
                x2="100"
                y2="100"
                stroke="#94A3B8"
                strokeWidth="8"
                strokeLinecap="round"
            />
            {/* Arrow head */}
            <polygon
                points="100,10 85,35 115,35"
                fill="#94A3B8"
            />
        </svg>
    );
}
