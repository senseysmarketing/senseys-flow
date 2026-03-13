import { 
  Home, 
  Users, 
  Calendar, 
  BarChart3, 
  Settings, 
  LogOut, 
  Building2,
  Sparkles,
  Shield,
  MessageSquare,
  Plug
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { 
  Sidebar, 
  SidebarContent, 
  SidebarGroup, 
  SidebarGroupContent, 
  SidebarGroupLabel, 
  SidebarMenu, 
  SidebarMenuButton, 
  SidebarMenuItem 
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";

import { useSuperAdmin } from "@/hooks/use-super-admin";
import { usePermissions } from "@/hooks/use-permissions";
import logoAlternativaBranca from "@/assets/logo-alternativa-branca.png";
import { cn } from "@/lib/utils";

const menuItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: Home,
  },
  {
    title: "Leads",
    url: "/leads",
    icon: Users,
  },
  {
    title: "Imóveis",
    url: "/properties",
    icon: Building2,
  },
  {
    title: "Agenda",
    url: "/calendar",
    icon: Calendar,
  },
  {
    title: "Conversas",
    url: "/conversations",
    icon: MessageSquare,
  },
  {
    title: "Relatórios",
    url: "/reports",
    icon: BarChart3,
  },
];

const bottomItems = [
  {
    title: "Integrações",
    url: "/integrations",
    icon: Plug,
  },
  {
    title: "Configurações",
    url: "/settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  const { account } = useAccount();
  const { isSuperAdmin } = useSuperAdmin();
  const { hasPermission } = usePermissions();
  const location = useLocation();

  const filteredMenuItems = menuItems.filter(item => {
    if (item.url === '/conversations') return hasPermission('conversations.view');
    return true;
  });
  
  
  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (e) {
      console.error("Logout error:", e);
    }
    
    // Clear any stale auth data from localStorage
    localStorage.removeItem('sb-ujodxlzlfvdwqufkgdnw-auth-token');
    
    toast({
      title: "Até logo!",
      description: "Logout realizado com sucesso.",
    });
    
    // Force page reload to clear all React state and redirect via Layout
    window.location.href = "/auth";
  };

  const logoSrc = account?.logo_url || logoAlternativaBranca;
  const companyName = account?.company_name || "";

  return (
    <Sidebar className="w-64 border-r-0 z-50">
      <SidebarContent className="bg-sidebar/95 backdrop-blur-xl">
        {/* Logo/Brand */}
        <div className="p-5 border-b border-sidebar-border/50">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img 
                src={logoSrc} 
                alt={companyName || "Logo"} 
                className="h-9 w-auto max-w-[160px] object-contain"
              />
              <div className="absolute -top-1 -right-1">
                <Sparkles className="h-3 w-3 text-primary animate-pulse" />
              </div>
            </div>
          </div>
        </div>

        {/* Main Navigation */}
        <SidebarGroup className="flex-1 px-3 py-4">
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs font-semibold uppercase tracking-wider px-3 mb-2">
            Menu Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {filteredMenuItems.map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative",
                          isActive
                            ? "bg-primary/15 text-primary font-medium"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                        )}
                      >
                        {isActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-gradient-to-b from-primary to-accent" />
                        )}
                        <div
                          className={cn(
                            "p-1.5 rounded-lg transition-all duration-200",
                            isActive
                              ? "bg-primary/20"
                              : "bg-transparent group-hover:bg-sidebar-accent/30"
                          )}
                        >
                          <item.icon
                            className={cn(
                              "h-4 w-4 transition-transform duration-200",
                              isActive && "scale-110"
                            )}
                          />
                        </div>
                        <span className="text-sm">{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Bottom Items */}
        <div className="mt-auto p-3 border-t border-sidebar-border/50">
          <SidebarMenu className="space-y-1">
            {/* Agency Admin Link - Only for super admins */}
            {isSuperAdmin && (
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to="/agency-admin"
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative",
                      location.pathname === "/agency-admin"
                        ? "bg-amber-500/15 text-amber-400 font-medium"
                        : "text-amber-400/70 hover:bg-amber-500/10 hover:text-amber-400"
                    )}
                  >
                    {location.pathname === "/agency-admin" && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-gradient-to-b from-amber-400 to-amber-600" />
                    )}
                    <div
                      className={cn(
                        "p-1.5 rounded-lg transition-all duration-200",
                        location.pathname === "/agency-admin"
                          ? "bg-amber-500/20"
                          : "bg-transparent group-hover:bg-amber-500/10"
                      )}
                    >
                      <Shield className="h-4 w-4" />
                    </div>
                    <span className="text-sm">Painel Agência</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}

            {bottomItems.map((item) => {
              const isActive = location.pathname === item.url;
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group",
                        isActive
                          ? "bg-primary/15 text-primary font-medium"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      )}
                    >
                      <div
                        className={cn(
                          "p-1.5 rounded-lg transition-all duration-200",
                          isActive
                            ? "bg-primary/20"
                            : "bg-transparent group-hover:bg-sidebar-accent/30"
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                      </div>
                      <span className="text-sm">{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}

            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Button
                  variant="ghost"
                  onClick={handleSignOut}
                  className="w-full justify-start gap-3 px-3 py-2.5 h-auto text-sidebar-foreground/70 hover:bg-destructive/10 hover:text-destructive rounded-xl transition-all duration-200"
                >
                  <div className="p-1.5 rounded-lg bg-transparent group-hover:bg-destructive/10">
                    <LogOut className="h-4 w-4" />
                  </div>
                  <span className="text-sm">Sair</span>
                </Button>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
