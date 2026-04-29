import { lazy, Suspense } from "react";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";

// Только Header + Hero загружаются сразу. Всё остальное — по мере необходимости,
// чтобы первый экран был быстрым на мобильном интернете.
const CommunitySection = lazy(() => import("@/components/CommunitySection"));
const CampaignsSection = lazy(() => import("@/components/CampaignsSection"));
const CompletedCampaignsSection = lazy(() => import("@/components/CompletedCampaignsSection"));
const DonationWidget = lazy(() => import("@/components/DonationWidget"));
const TrustSection = lazy(() => import("@/components/TrustSection"));
const DetailsSection = lazy(() => import("@/components/DetailsSection"));
const DirectorSection = lazy(() => import("@/components/DirectorSection"));
const ContactsSection = lazy(() => import("@/components/ContactsSection"));
const FAQSection = lazy(() => import("@/components/FAQSection"));
const LegalSection = lazy(() => import("@/components/LegalSection"));
const Footer = lazy(() => import("@/components/Footer"));

const SectionFallback = () => <div className="min-h-[200px]" aria-hidden />;

const Index = () => (
  <div className="min-h-screen">
    <Header />
    <HeroSection />
    <Suspense fallback={<SectionFallback />}>
      <CommunitySection />
      <CampaignsSection />
      <CompletedCampaignsSection limit={3} />
      <DonationWidget />
      <TrustSection />
      <DetailsSection />
      <DirectorSection />
      <ContactsSection />
      <FAQSection />
      <LegalSection />
      <Footer />
    </Suspense>
  </div>
);

export default Index;
