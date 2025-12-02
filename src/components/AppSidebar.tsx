import { Home, Users, Calendar, BarChart3, Settings, LogOut, Building2 } from "lucide-react";
import { NavLink } from "react-router-dom";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
import { useAccount } from "@/hooks/use-account";
import logoAlternativaBranca from "@/assets/logo-alternativa-branca.png";

const menuItems = [{
  title: "Dashboard",
  url: "/dashboard",
  icon: Home
}, {
  title: "Leads",
  url: "/leads",
  icon: Users
}, {
  title: "Imóveis",
  url: "/properties",
  icon: Building2
}, {
  title: "Agenda",
  url: "/calendar",
  icon: Calendar
}, {
  title: "Relatórios",
  url: "/reports",
  icon: BarChart3
}];

const bottomItems = [{
  title: "Configurações",
  url: "/settings",
  icon: Settings
}];

export function AppSidebar() {
  const { account } = useAccount();
  
  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao sair",
        description: error.message
      });
    } else {
      toast({
        title: "Logout realizado",
        description: "Até logo!"
      });
    }
  };

  // Use custom logo if available, otherwise use default
  const logoSrc = account?.logo_url || logoAlternativaBranca;
  const companyName = account?.company_name || "";

  return (
    <Sidebar className="w-64">
      <SidebarContent className="bg-sidebar">
        {/* Logo/Brand */}
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <img 
              src={logoSrc} 
              alt={companyName || "Logo"} 
              className="h-8 w-auto max-w-[180px] object-contain"
            />
          </div>
        </div>

        {/* Main Navigation */}
        <SidebarGroup className="flex-1">
          <SidebarGroupLabel className="text-sidebar-foreground/70">
            Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map(item => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      className={({ isActive }) => 
                        `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                          isActive 
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
                            : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                        }`
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Bottom Items */}
        <div className="mt-auto p-2 border-t border-sidebar-border">
          <SidebarMenu>
            {bottomItems.map(item => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild>
                  <NavLink 
                    to={item.url} 
                    className={({ isActive }) => 
                      `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        isActive 
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
                          : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                      }`
                    }
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
            
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Button 
                  variant="ghost" 
                  onClick={handleSignOut} 
                  className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                >
                  <LogOut className="h-4 w-4 mr-3" />
                  <span>Sair</span>
                </Button>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}