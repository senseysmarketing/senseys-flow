import { Fragment, createElement, type ReactNode } from "react";
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

const withLayout = (page: ReactNode, fullHeight = false) =>
  createElement(Layout, fullHeight ? { fullHeight: true, children: page } : { children: page });

const routes = [
  createElement(Route, { key: "/", path: "/", element: withLayout(createElement(Index)) }),
  createElement(Route, { key: "/auth", path: "/auth", element: withLayout(createElement(Auth)) }),
  createElement(Route, { key: "/auth/support-callback", path: "/auth/support-callback", element: createElement(SupportCallback) }),
  createElement(Route, { key: "/dashboard", path: "/dashboard", element: withLayout(createElement(Dashboard)) }),
  createElement(Route, { key: "/leads", path: "/leads", element: withLayout(createElement(Leads), true) }),
  createElement(Route, { key: "/properties", path: "/properties", element: withLayout(createElement(Properties)) }),
  createElement(Route, { key: "/calendar", path: "/calendar", element: withLayout(createElement(Calendar)) }),
  createElement(Route, { key: "/reports", path: "/reports", element: withLayout(createElement(Reports)) }),
  createElement(Route, { key: "/settings", path: "/settings", element: withLayout(createElement(Settings)) }),
  createElement(Route, { key: "/conversations", path: "/conversations", element: withLayout(createElement(Conversations), true) }),
  createElement(Route, { key: "/integrations", path: "/integrations", element: withLayout(createElement(Integrations)) }),
  createElement(Route, { key: "/agency-admin", path: "/agency-admin", element: withLayout(createElement(AgencyAdmin)) }),
  createElement(Route, { key: "*", path: "*", element: withLayout(createElement(NotFound)) }),
];

function AppProviders() {
  return createElement(
    QueryClientProvider,
    { client: queryClient },
    createElement(
      TooltipProvider,
      null,
      createElement(
        AuthProvider,
        null,
        createElement(
          PermissionsProvider,
          null,
          createElement(
            AccountProvider,
            null,
            createElement(
              FirebaseMessagingProvider,
              null,
              createElement(
                Fragment,
                null,
                createElement(Toaster),
                createElement(Sonner),
                createElement(
                  BrowserRouter,
                  null,
                  createElement(Routes, null, ...routes),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

export default AppProviders;
