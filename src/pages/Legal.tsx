import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LegalSection from "@/components/LegalSection";

const Legal = () => (
  <div className="min-h-screen flex flex-col">
    <Header />
    <main className="flex-1 pt-20">
      <LegalSection />
    </main>
    <Footer />
  </div>
);

export default Legal;