import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Singularity Service Acquisitions | Electrical Contracting M&A",
  description:
    "Singularity Service Acquisitions acquires and operates premier electrical contracting firms in the NY Tri-State area. Preserving legacies, empowering teams, unlocking growth.",
  keywords: [
    "search fund",
    "electrical contracting",
    "business acquisition",
    "M&A",
    "Tri-State",
    "Connecticut",
    "New York",
    "electrical services",
  ],
  openGraph: {
    title: "Singularity Service Acquisitions",
    description:
      "Partnering with the Tri-State's premier electrical firms. Preserving legacies, empowering teams.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${geist.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
