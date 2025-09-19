import { useState } from "react";
import { Home, Users, Calendar, BarChart3, Settings, LogOut, Building2, User } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
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
  const location = useLocation();
  const handleSignOut = async () => {
    const {
      error
    } = await signOut();
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
  return <Sidebar className="w-64">
      <SidebarContent className="bg-sidebar">
        {/* Logo/Brand */}
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center">
            <img 
              src={logoAlternativaBranca} 
              alt="Logo" 
              className="h-8 w-auto"
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
              {menuItems.map(item => <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={({
                  isActive
                }) => `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Bottom Items */}
        <div className="mt-auto p-2 border-t border-sidebar-border">
          <SidebarMenu>
            {bottomItems.map(item => <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild>
                  <NavLink to={item.url} className={({
                isActive
              }) => `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"}`}>
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>)}
            
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Button variant="ghost" onClick={handleSignOut} className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground">
                  <LogOut className="h-4 w-4 mr-3" />
                  <span>Sair</span>
                </Button>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      </SidebarContent>
    </Sidebar>;
}