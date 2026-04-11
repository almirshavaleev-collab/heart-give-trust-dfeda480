import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import CommunitySection from "@/components/CommunitySection";
import DonationWidget from "@/components/DonationWidget";
import TrustSection from "@/components/TrustSection";
import DetailsSection from "@/components/DetailsSection";
import DirectorSection from "@/components/DirectorSection";
import ContactsSection from "@/components/ContactsSection";
import FAQSection from "@/components/FAQSection";
import LegalSection from "@/components/LegalSection";
import Footer from "@/components/Footer";

const Index = () => (
  <div className="min-h-screen">
    <Header />
    <HeroSection />
    <CommunitySection />
    <DonationWidget />
    <TrustSection />
    <DetailsSection />
    <DirectorSection />
    <ContactsSection />
    <FAQSection />
    <LegalSection />
    <Footer />
  </div>
);

export default Index;
