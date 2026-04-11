import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import ImpactSection from "@/components/ImpactSection";
import DonationWidget from "@/components/DonationWidget";
import TrustSection from "@/components/TrustSection";
import DetailsSection from "@/components/DetailsSection";
import DirectorSection from "@/components/DirectorSection";
import ContactsSection from "@/components/ContactsSection";
import FAQSection from "@/components/FAQSection";
import Footer from "@/components/Footer";

const Index = () => (
  <div className="min-h-screen">
    <Header />
    <HeroSection />
    <ImpactSection />
    <DonationWidget />
    <TrustSection />
    <DetailsSection />
    <DirectorSection />
    <ContactsSection />
    <FAQSection />
    <Footer />
  </div>
);

export default Index;
