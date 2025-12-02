import { useAuth } from "@/hooks/use-auth";
import { Navigate, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import WhatsAppFloat from "@/components/WhatsAppFloat";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Bell, Search, Menu } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
}

const routeTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/leads": "Leads",
  "/properties": "Imóveis",
  "/calendar": "Agenda",
  "/reports": "Relatórios",
  "/settings": "Configurações",
};

const Layout = ({ children }: LayoutProps) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [isDark, setIsDark] = useState(true);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle("dark");
  };

  const currentTitle = routeTitles[location.pathname] || "Senseys CRM";

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

        <div className="flex-1 flex flex-col">
          {/* Modern Header */}
          <header className="h-16 border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-40">
            <div className="h-full flex items-center justify-between px-4 lg:px-6">
              {/* Left side */}
              <div className="flex items-center gap-4">
                <SidebarTrigger className="lg:hidden">
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SidebarTrigger>

                <div className="hidden sm:block">
                  <h1 className="text-lg font-semibold">{currentTitle}</h1>
                </div>
              </div>

              {/* Right side */}
              <div className="flex items-center gap-2">
                {/* Search button */}
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
                  className="h-9 w-9 relative"
                >
                  <Bell className="h-4 w-4" />
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary animate-pulse" />
                </Button>

                {/* Theme toggle */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleTheme}
                  className={cn(
                    "h-9 w-9 transition-all duration-300",
                    !isDark && "bg-warning/10 text-warning"
                  )}
                >
                  {isDark ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 p-4 lg:p-6 overflow-auto custom-scrollbar">
            <div className="animate-in">{children}</div>
          </main>
        </div>

        <WhatsAppFloat />
      </div>
    </SidebarProvider>
  );
};

export default Layout;
