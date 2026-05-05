import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import CampaignPage from "./pages/CampaignPage.tsx";
import CampaignsListPage from "./pages/CampaignsListPage.tsx";
import ThankYou from "./pages/ThankYou.tsx";
import Offer from "./pages/Offer.tsx";
import PrivacyConsent from "./pages/PrivacyConsent.tsx";
import Requisites from "./pages/Requisites.tsx";
import Legal from "./pages/Legal.tsx";
import NotFound from "./pages/NotFound.tsx";
import Auth from "./pages/Auth.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import AuthCallback from "./pages/AuthCallback.tsx";
import AccountLayout from "./pages/account/AccountLayout.tsx";
import AccountOverview from "./pages/account/AccountOverview.tsx";
import AccountDonations from "./pages/account/AccountDonations.tsx";
import AccountSubscriptions from "./pages/account/AccountSubscriptions.tsx";
import AccountAchievements from "./pages/account/AccountAchievements.tsx";
import AccountSettings from "./pages/account/AccountSettings.tsx";
import AdminLogin from "./pages/admin/AdminLogin.tsx";
import AdminLayout from "./pages/admin/AdminLayout.tsx";
import AdminCampaigns from "./pages/admin/AdminCampaigns.tsx";
import AdminNews from "./pages/admin/AdminNews.tsx";
import AdminReports from "./pages/admin/AdminReports.tsx";
import AdminDonations from "./pages/admin/AdminDonations.tsx";
import AdminDashboard from "./pages/admin/AdminDashboard.tsx";
import AdminDonors from "./pages/admin/AdminDonors.tsx";
import ScrollToTop from "./components/ScrollToTop.tsx";
import { ProtectedRoute } from "./components/ProtectedRoute.tsx";
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
        <ScrollToTop />
        <RealtimeBridge />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/campaigns" element={<CampaignsListPage />} />
          <Route path="/campaigns/:slug" element={<CampaignPage />} />
          <Route path="/thank-you" element={<ThankYou />} />
          <Route path="/offer" element={<Offer />} />
          <Route path="/privacy-consent" element={<PrivacyConsent />} />
          <Route path="/privacy" element={<PrivacyConsent />} />
          <Route path="/requisites" element={<Requisites />} />
          <Route path="/legal" element={<Legal />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/login" element={<Navigate to="/auth" replace />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/account"
            element={
              <ProtectedRoute>
                <AccountLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/account/overview" replace />} />
            <Route path="overview" element={<AccountOverview />} />
            <Route path="donations" element={<AccountDonations />} />
            <Route path="subscriptions" element={<AccountSubscriptions />} />
            <Route path="achievements" element={<AccountAchievements />} />
            <Route path="settings" element={<AccountSettings />} />
          </Route>
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute requireAdmin redirectTo="/admin/login">
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="campaigns" element={<AdminCampaigns />} />
            <Route path="news" element={<AdminNews />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="donations" element={<AdminDonations />} />
            <Route path="donors" element={<AdminDonors />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
