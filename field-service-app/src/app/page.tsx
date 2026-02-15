import { Header } from '@/components/landing/Header';
import { Hero } from '@/components/landing/Hero';
import { FeatureGrid } from '@/components/landing/FeatureGrid';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { Footer } from '@/components/landing/Footer';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Field Service Pro - All-in-One Field Service Management',
  description: 'Streamline your operations with the most intuitive platform for field service teams. Schedule jobs, track technicians, and get paid faster.',
};

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />
      <main className="flex-1">
        <Hero />
        <FeatureGrid />
        <HowItWorks />
      </main>
      <Footer />
    </div>
  );
}
