import Header from "@/components/landing/Header";
import HeroSection from "@/components/landing/HeroSection";
import StatsSection from "@/components/landing/StatsSection";
import DestinationsSection from "@/components/landing/DestinationsSection";
import ToursSection from "@/components/landing/ToursSection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import PartnersSection from "@/components/landing/PartnersSection";
import Footer from "@/components/landing/Footer";

export default function Home() {
  return (
    <>
      <Header />
      
      <main className="flex-grow">
        <HeroSection />
        <StatsSection />
        <DestinationsSection />
        <ToursSection />
        <HowItWorksSection />
        <PartnersSection />
      </main>

      <Footer />
    </>
  );
}
