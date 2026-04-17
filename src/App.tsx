import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import CampaignPage from "./pages/CampaignPage.tsx";
import CampaignsListPage from "./pages/CampaignsListPage.tsx";
import ThankYou from "./pages/ThankYou.tsx";
import NotFound from "./pages/NotFound.tsx";
import AdminLogin from "./pages/admin/AdminLogin.tsx";
import AdminLayout from "./pages/admin/AdminLayout.tsx";
import AdminCampaigns from "./pages/admin/AdminCampaigns.tsx";
import AdminNews from "./pages/admin/AdminNews.tsx";
import AdminReports from "./pages/admin/AdminReports.tsx";
import AdminDonations from "./pages/admin/AdminDonations.tsx";
import { useCampaignsRealtime } from "./hooks/useCampaigns";

const queryClient = new QueryClient();

const RealtimeBridge = () => {
  useCampaignsRealtime();
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <RealtimeBridge />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/campaigns" element={<CampaignsListPage />} />
          <Route path="/campaigns/:slug" element={<CampaignPage />} />
          <Route path="/thank-you" element={<ThankYou />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/campaigns" replace />} />
            <Route path="campaigns" element={<AdminCampaigns />} />
            <Route path="news" element={<AdminNews />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="donations" element={<AdminDonations />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
