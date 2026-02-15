import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { AgentProvider } from "@/lib/agent/context";
import { AgentChat } from "@/components/agent/AgentChat";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Field Service Manager",
  description: "Mobile-first field service management for technicians",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <AgentProvider>
          {children}
          <AgentChat />
          <Toaster
            position="top-center"
            richColors
            closeButton
            toastOptions={{
              duration: 4000,
            }}
          />
        </AgentProvider>
      </body>
    </html>
  );
}
