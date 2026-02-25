import Navbar from "@/components/Navbar";
import HeroSection from "@/components/sections/HeroSection";
import AboutSection from "@/components/sections/AboutSection";
import MoRSection from "@/components/sections/MoRSection";
import InvestmentGrid from "@/components/sections/InvestmentGrid";
import ContactSection from "@/components/sections/ContactSection";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <AboutSection />
        <MoRSection />
        <InvestmentGrid />
        <ContactSection />
      </main>
      <Footer />
    </>
  );
}
