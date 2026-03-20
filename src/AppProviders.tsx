import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/use-auth";
import { AccountProvider } from "@/hooks/use-account";
import { PermissionsProvider } from "@/hooks/use-permissions";
import { FirebaseMessagingProvider } from "@/hooks/use-firebase-messaging";
import Layout from "@/components/Layout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import Properties from "./pages/Properties";
import Calendar from "./pages/Calendar";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import AgencyAdmin from "./pages/AgencyAdmin";
import SupportCallback from "./pages/SupportCallback";
import Conversations from "./pages/Conversations";
import Integrations from "./pages/Integrations";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppProviders() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <PermissionsProvider>
            <AccountProvider>
              <FirebaseMessagingProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                  <Routes>
                    <Route path="/" element={<Layout><Index /></Layout>} />
                    <Route path="/auth" element={<Layout><Auth /></Layout>} />
                    <Route path="/auth/support-callback" element={<SupportCallback />} />
                    <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
                    <Route path="/leads" element={<Layout fullHeight><Leads /></Layout>} />
                    <Route path="/properties" element={<Layout><Properties /></Layout>} />
                    <Route path="/calendar" element={<Layout><Calendar /></Layout>} />
                    <Route path="/reports" element={<Layout><Reports /></Layout>} />
                    <Route path="/settings" element={<Layout><Settings /></Layout>} />
                    <Route path="/conversations" element={<Layout fullHeight><Conversations /></Layout>} />
                    <Route path="/integrations" element={<Layout><Integrations /></Layout>} />
                    <Route path="/agency-admin" element={<Layout><AgencyAdmin /></Layout>} />
                    <Route path="*" element={<Layout><NotFound /></Layout>} />
                  </Routes>
                </BrowserRouter>
              </FirebaseMessagingProvider>
            </AccountProvider>
          </PermissionsProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default AppProviders;
