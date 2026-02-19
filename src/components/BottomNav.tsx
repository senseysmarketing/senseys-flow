import { NavLink, useLocation } from "react-router-dom";
import { Home, Users, Building2, MessageSquare, Settings, Plug } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";

const allNavItems = [
  { to: "/dashboard", icon: Home, label: "Home" },
  { to: "/leads", icon: Users, label: "Leads" },
  { to: "/conversations", icon: MessageSquare, label: "Conversas", permission: "conversations.view" },
  { to: "/properties", icon: Building2, label: "Imóveis" },
  { to: "/integrations", icon: Plug, label: "Integrações" },
  { to: "/settings", icon: Settings, label: "Config" },
];

const BottomNav = () => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const { hasPermission } = usePermissions();

  const navItems = allNavItems.filter(item => {
    if (item.permission) return hasPermission(item.permission);
    return true;
  });

  if (!isMobile) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-background/95 backdrop-blur-xl border-t border-border/50 z-50 safe-area-bottom">
      <div className="h-full flex items-center justify-around px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to || 
            (item.to !== "/dashboard" && location.pathname.startsWith(item.to));
          
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 py-2 px-3 rounded-xl transition-all min-w-[60px]",
                isActive 
                  ? "text-primary bg-primary/10" 
                  : "text-muted-foreground hover:text-foreground active:scale-95"
              )}
            >
              <item.icon className={cn(
                "h-5 w-5 transition-transform",
                isActive && "scale-110"
              )} />
              <span className={cn(
                "text-[10px] font-medium",
                isActive && "text-primary"
              )}>
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
