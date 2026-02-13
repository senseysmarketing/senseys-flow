import { useAuth } from "@/hooks/use-auth";
import { useAccount } from "@/hooks/use-account";
import { useSupportMode } from "@/hooks/use-support-mode";
import { useLeadNotifications } from "@/hooks/use-lead-notifications";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

import BottomNav from "@/components/BottomNav";
import SmartBanner from "@/components/SmartBanner";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Bell, Search, Menu, Wrench, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface LayoutProps {
  children: React.ReactNode;
  fullHeight?: boolean;
}

const Layout = ({ children, fullHeight = false }: LayoutProps) => {
  const { user, loading } = useAuth();
  const { account, userFullName } = useAccount();
  const { isSupportMode, supportAccountName, exitSupportMode } = useSupportMode();
  const location = useLocation();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  // Global lead notifications - enabled across all pages
  const [notificationsEnabled] = useState(() => {
    return localStorage.getItem('lead-notifications-enabled') !== 'false';
  });
  
  // Activate global notification listener for all new leads
  useLeadNotifications(undefined, notificationsEnabled && !!user);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle("dark");
  };

  const handleExitSupportMode = async () => {
    setIsExiting(true);
    await exitSupportMode();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
            <div className="absolute inset-0 h-12 w-12 rounded-full bg-primary/10 animate-pulse" />
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user && location.pathname !== "/auth") {
    return <Navigate to="/auth" replace />;
  }

  if (user && location.pathname === "/auth") {
    return <Navigate to="/dashboard" replace />;
  }

  if (location.pathname === "/auth") {
    return <>{children}</>;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />

        <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
          {/* Support Mode Banner */}
          {isSupportMode && (
            <div className="bg-amber-500/20 border-b border-amber-500/30 px-4 py-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-400">
                  <Wrench className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    Modo Suporte - Acessando: {supportAccountName || account?.company_name || account?.name}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExitSupportMode}
                  disabled={isExiting}
                  className="h-7 gap-1.5 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {isExiting ? "Saindo..." : "Voltar para Agência"}
                </Button>
              </div>
            </div>
          )}

          {/* Modern Header */}
          <header className="h-14 sm:h-16 border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-40">
            <div className="h-full flex items-center justify-between px-3 sm:px-4 lg:px-6">
              {/* Left side */}
              <div className="flex items-center gap-2 sm:gap-4">
                <SidebarTrigger className="lg:hidden">
                  <Button variant="ghost" size="icon" className="h-10 w-10 sm:h-9 sm:w-9">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SidebarTrigger>

                <div className="hidden sm:block">
                  <h1 className="text-base font-semibold">{account?.company_name || account?.name || "Carregando..."}</h1>
                  <p className="text-xs text-muted-foreground">Logado como: {userFullName || "..."}</p>
                </div>
                
                {/* Mobile: Show only company name, truncated */}
                <div className="sm:hidden">
                  <h1 className="text-sm font-semibold truncate max-w-[150px]">
                    {account?.company_name || account?.name || "..."}
                  </h1>
                </div>
              </div>

              {/* Right side */}
              <div className="flex items-center gap-1 sm:gap-2">
                {/* Search button - hidden on mobile */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden md:flex items-center gap-2 text-muted-foreground hover:text-foreground px-3 h-9 rounded-lg bg-muted/50"
                >
                  <Search className="h-4 w-4" />
                  <span className="text-sm">Buscar...</span>
                  <kbd className="hidden lg:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                    ⌘K
                  </kbd>
                </Button>

                {/* Notifications */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 sm:h-9 sm:w-9 relative"
                  onClick={() => navigate('/settings?tab=notifications')}
                >
                  <Bell className="h-5 w-5 sm:h-4 sm:w-4" />
                  <span className="absolute top-2 right-2 sm:top-1.5 sm:right-1.5 h-2 w-2 rounded-full bg-primary animate-pulse" />
                </Button>

                {/* Theme toggle */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleTheme}
                  className={cn(
                    "h-10 w-10 sm:h-9 sm:w-9 transition-all duration-300",
                    !isDark && "bg-warning/10 text-warning"
                  )}
                >
                  {isDark ? (
                    <Sun className="h-5 w-5 sm:h-4 sm:w-4" />
                  ) : (
                    <Moon className="h-5 w-5 sm:h-4 sm:w-4" />
                  )}
                </Button>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className={cn(
            "flex-1 p-4 lg:p-6",
            !fullHeight && "overflow-x-hidden overflow-y-auto custom-scrollbar",
            fullHeight && "overflow-hidden",
            isMobile && "pb-20" // Space for bottom nav
          )}>
            <div className={cn(
              "animate-in",
              !fullHeight && "w-full max-w-full",
              fullHeight && "h-full w-full"
            )}>{children}</div>
          </main>
        </div>

        <BottomNav />
        <SmartBanner />
      </div>
    </SidebarProvider>
  );
};

export default Layout;
