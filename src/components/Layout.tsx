import { useAuth } from "@/hooks/use-auth";
import { useAccount } from "@/hooks/use-account";
import { useSupportMode } from "@/hooks/use-support-mode";
import { useLeadNotifications } from "@/hooks/use-lead-notifications";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { FloatingSidebar } from "@/components/FloatingSidebar";
import BottomNav from "@/components/BottomNav";
import SmartBanner from "@/components/SmartBanner";
import { Button } from "@/components/ui/button";
import { Bell, Search, Wrench, ArrowLeft } from "lucide-react";
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
  const [isExiting, setIsExiting] = useState(false);

  // Global lead notifications
  const [notificationsEnabled] = useState(() => {
    return localStorage.getItem('lead-notifications-enabled') !== 'false';
  });
  useLeadNotifications(undefined, notificationsEnabled && !!user);

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

  const firstName = userFullName?.split(' ')[0] || '...';

  return (
    <div className="min-h-screen bg-background">
      {/* Floating Sidebar — desktop only */}
      <FloatingSidebar />

      {/* Main area — offset left for floating sidebar on desktop */}
      <div className={cn(
        "flex flex-col min-h-screen",
        !isMobile && "ml-[80px]"
      )}>
        {/* Support Mode Banner */}
        {isSupportMode && (
          <div className="bg-warning/20 border-b border-warning/30 px-4 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-warning">
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
                className="h-7 gap-1.5 border-warning/30 text-warning hover:bg-warning/10"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {isExiting ? "Saindo..." : "Voltar para Agência"}
              </Button>
            </div>
          </div>
        )}

        {/* Top Bar — clean and minimal */}
        <header className="h-14 sm:h-16 sticky top-0 z-40 bg-background/60 backdrop-blur-xl border-b border-border/30">
          <div className="h-full flex items-center justify-between px-4 lg:px-6">
            {/* Left — greeting */}
            <div>
              <h1 className="text-base font-medium text-foreground">
                Olá, <span className="font-semibold">{firstName}</span>
              </h1>
            </div>

            {/* Center — search bar (hidden on mobile) */}
            <div className="hidden md:flex items-center">
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground px-4 h-9 rounded-xl glass"
              >
                <Search className="h-4 w-4" />
                <span className="text-sm">Buscar...</span>
                <kbd className="hidden lg:inline-flex h-5 items-center gap-1 rounded border border-border/50 bg-muted/50 px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  ⌘K
                </kbd>
              </Button>
            </div>

            {/* Right — notifications */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 sm:h-9 sm:w-9 relative"
                onClick={() => navigate('/settings?tab=notifications')}
              >
                <Bell className="h-5 w-5 sm:h-4 sm:w-4 text-muted-foreground" />
                {/* Radar ping indicator */}
                <span className="absolute top-2 right-2 sm:top-1.5 sm:right-1.5 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
                </span>
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className={cn(
          "flex-1 p-4 lg:p-6",
          !fullHeight && "overflow-x-hidden overflow-y-auto custom-scrollbar",
          fullHeight && "overflow-hidden",
          isMobile && "pb-20"
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
  );
};

export default Layout;