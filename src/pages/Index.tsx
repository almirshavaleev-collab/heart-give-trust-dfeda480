import { lazy, Suspense, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import { Skeleton } from "@/components/ui/skeleton";

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

/* ---------- Skeleton-заглушки под каждую секцию ---------- */

const SectionShell = ({
  children,
  alt = false,
}: {
  children: React.ReactNode;
  alt?: boolean;
}) => (
  <section aria-hidden className={`py-24 md:py-32 ${alt ? "section-alt" : ""}`}>
    <div className="container">{children}</div>
  </section>
);

const HeaderBlockSkeleton = () => (
  <div className="text-center mb-16 flex flex-col items-center">
    <Skeleton className="h-3 w-28 mb-3" />
    <Skeleton className="h-9 w-72 max-w-full mb-4" />
    <Skeleton className="h-4 w-96 max-w-full" />
  </div>
);

const CommunitySkeleton = () => (
  <SectionShell alt>
    <HeaderBlockSkeleton />
    <div className="grid lg:grid-cols-2 gap-10 items-center">
      <Skeleton className="h-80 md:h-96 w-full rounded-2xl" />
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card-light p-6 flex items-start gap-4">
            <Skeleton className="w-12 h-12 rounded-2xl shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </SectionShell>
);

const CampaignsGridSkeleton = ({
  alt = false,
  count = 3,
}: {
  alt?: boolean;
  count?: number;
}) => (
  <SectionShell alt={alt}>
    <HeaderBlockSkeleton />
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border bg-card overflow-hidden">
          <Skeleton className="h-44 w-full rounded-none" />
          <div className="p-5 space-y-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-2 w-full rounded-full" />
            <div className="flex justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        </div>
      ))}
    </div>
  </SectionShell>
);

const DonationWidgetSkeleton = () => (
  <SectionShell>
    <div className="max-w-xl mx-auto card-light p-8 space-y-5">
      <Skeleton className="h-7 w-2/3 mx-auto" />
      <Skeleton className="h-4 w-3/4 mx-auto" />
      <div className="grid grid-cols-3 gap-3 pt-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-12 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-xl mt-2" />
    </div>
  </SectionShell>
);

const TrustSkeleton = () => (
  <SectionShell>
    <HeaderBlockSkeleton />
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="card-light p-6 text-center flex flex-col items-center">
          <Skeleton className="w-14 h-14 rounded-2xl mb-4" />
          <Skeleton className="h-4 w-32 mb-2" />
          <Skeleton className="h-3 w-40" />
        </div>
      ))}
    </div>
  </SectionShell>
);

const DetailsSkeleton = () => (
  <SectionShell alt>
    <div className="max-w-3xl mx-auto card-light p-8 md:p-12 flex flex-col items-center">
      <Skeleton className="w-14 h-14 rounded-full mb-6" />
      <Skeleton className="h-7 w-3/4 mb-3" />
      <Skeleton className="h-4 w-1/2 mb-8" />
      <div className="flex gap-3">
        <Skeleton className="h-10 w-32 rounded-md" />
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>
    </div>
  </SectionShell>
);

const DirectorSkeleton = () => (
  <SectionShell>
    <div className="grid lg:grid-cols-2 gap-10 items-center max-w-5xl mx-auto">
      <Skeleton className="h-80 md:h-[420px] w-full rounded-2xl" />
      <div className="space-y-4">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  </SectionShell>
);

const ContactsSkeleton = () => (
  <SectionShell alt>
    <div className="max-w-3xl mx-auto">
      <HeaderBlockSkeleton />
      <div className="grid sm:grid-cols-3 gap-6 mb-10">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card-light p-6 flex flex-col items-center">
            <Skeleton className="w-6 h-6 mb-3" />
            <Skeleton className="h-3 w-16 mb-2" />
            <Skeleton className="h-4 w-40" />
          </div>
        ))}
      </div>
      <Skeleton className="h-[300px] md:h-[400px] w-full rounded-xl" />
    </div>
  </SectionShell>
);

const AccordionSkeleton = ({
  alt = false,
  items = 4,
}: {
  alt?: boolean;
  items?: number;
}) => (
  <SectionShell alt={alt}>
    <div className="max-w-2xl mx-auto">
      <HeaderBlockSkeleton />
      <div className="space-y-3">
        {Array.from({ length: items }).map((_, i) => (
          <div key={i} className="card-light px-6 py-5">
            <Skeleton className="h-5 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  </SectionShell>
);

const FooterSkeleton = () => (
  <div className="border-t border-border py-12" aria-hidden>
    <div className="container grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-36" />
        </div>
      ))}
    </div>
  </div>
);

/* ---------- Страница ---------- */

const PENDING_PAYMENT_KEY = "ligafund:pending_payment";

const usePaymentSuccessToast = () => {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") !== "success") return;

    const isRecurring = params.get("mode") === "recurring";
    toast.success(
      isRecurring
        ? "Спасибо! Регулярная поддержка оформлена ❤️"
        : "Спасибо за поддержку ❤️",
      {
        description: isRecurring
          ? "Управлять подпиской можно в личном кабинете."
          : "Мы свяжемся с вами после подтверждения платежа.",
      },
    );

    const cleanUrl = window.location.pathname + window.location.hash;
    window.history.replaceState({}, "", cleanUrl);

    (async () => {
      let pending: { donation_id?: string | null; payment_id?: string | null } | null = null;
      try {
        const raw = localStorage.getItem(PENDING_PAYMENT_KEY);
        pending = raw ? JSON.parse(raw) : null;
      } catch { /* ignore */ }
      if (!pending?.donation_id && !pending?.payment_id) return;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const { data, error } = await supabase.functions.invoke("sync-yookassa-payment", {
          body: {
            donation_id: pending.donation_id ?? null,
            payment_id: pending.payment_id ?? null,
          },
        });
        if (!error && data?.results?.some((r: { status?: string }) => r.status === "succeeded")) {
          try { localStorage.removeItem(PENDING_PAYMENT_KEY); } catch { /* ignore */ }
          break;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
      }
    })();
  }, []);
};

const Index = () => {
  usePaymentSuccessToast();
  return (
  <div className="min-h-screen">
    <Header />
    <HeroSection />
    <Suspense fallback={<CommunitySkeleton />}>
      <CommunitySection />
    </Suspense>
    <Suspense fallback={<CampaignsGridSkeleton />}>
      <CampaignsSection />
    </Suspense>
    <Suspense fallback={<CampaignsGridSkeleton alt count={3} />}>
      <CompletedCampaignsSection limit={3} />
    </Suspense>
    <Suspense fallback={<DonationWidgetSkeleton />}>
      <DonationWidget />
    </Suspense>
    <Suspense fallback={<TrustSkeleton />}>
      <TrustSection />
    </Suspense>
    <Suspense fallback={<DetailsSkeleton />}>
      <DetailsSection />
    </Suspense>
    <Suspense fallback={<DirectorSkeleton />}>
      <DirectorSection />
    </Suspense>
    <Suspense fallback={<ContactsSkeleton />}>
      <ContactsSection />
    </Suspense>
    <Suspense fallback={<AccordionSkeleton items={4} />}>
      <FAQSection />
    </Suspense>
    <Suspense fallback={<AccordionSkeleton alt items={4} />}>
      <LegalSection />
    </Suspense>
    <Suspense fallback={<FooterSkeleton />}>
      <Footer />
    </Suspense>
  </div>
  );
};

export default Index;