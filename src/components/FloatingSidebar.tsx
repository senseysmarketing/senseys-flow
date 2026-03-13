import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { NavLink, useLocation } from "react-router-dom";
import { 
  Home, 
  Users, 
  Building2, 
  Calendar, 
  Sparkles, 
  Settings, 
  LogOut, 
  Shield,
  Plug,
  MessageSquare
} from "lucide-react";
import { signOut } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
import { useAccount } from "@/hooks/use-account";
import { useSuperAdmin } from "@/hooks/use-super-admin";
import { usePermissions } from "@/hooks/use-permissions";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import logoAlternativaBranca from "@/assets/logo-alternativa-branca.png";

const menuItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Leads", url: "/leads", icon: Users },
  { title: "Imóveis", url: "/properties", icon: Building2 },
  { title: "Agenda", url: "/calendar", icon: Calendar },
  { title: "Conversas", url: "/conversations", icon: MessageSquare, permission: "conversations.view" },
  { title: "Relatórios", url: "/reports", icon: Sparkles },
];

const bottomItems = [
  { title: "Integrações", url: "/integrations", icon: Plug },
  { title: "Configurações", url: "/settings", icon: Settings },
];

export function FloatingSidebar() {
  const [isExpanded, setIsExpanded] = useState(false);
  const location = useLocation();
  const { account } = useAccount();
  const { isSuperAdmin } = useSuperAdmin();
  const { hasPermission } = usePermissions();
  const isMobile = useIsMobile();

  const filteredMenuItems = menuItems.filter(item => {
    if (item.permission) return hasPermission(item.permission);
    return true;
  });

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (e) {
      console.error("Logout error:", e);
    }
    localStorage.removeItem('sb-ujodxlzlfvdwqufkgdnw-auth-token');
    toast({ title: "Até logo!", description: "Logout realizado com sucesso." });
    window.location.href = "/auth";
  };

  // Hide on mobile — BottomNav handles navigation there
  if (isMobile) return null;

  const logoSrc = account?.logo_url || logoAlternativaBranca;

  return (
    <motion.nav
      className="fixed left-4 top-1/2 -translate-y-1/2 z-50 flex flex-col rounded-2xl bg-[#465666] overflow-hidden shadow-elevated"
      initial={false}
      animate={{ width: isExpanded ? 200 : 64 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* Logo */}
      <div className="flex items-center justify-center px-3 py-4 border-b border-border/30">
        <img 
          src={logoSrc} 
          alt="Logo" 
          className={cn(
            "object-contain transition-all duration-300",
            isExpanded ? "h-7 w-auto max-w-[140px]" : "h-7 w-7"
          )}
        />
      </div>

      {/* Main menu */}
      <div className="flex-1 flex flex-col gap-1 py-3 px-2">
        {filteredMenuItems.map((item) => {
          const isActive = location.pathname === item.url;
          return (
            <NavLink
              key={item.url}
              to={item.url}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative group min-h-[40px]",
                isActive
                  ? "bg-white/10 text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-primary" />
              )}
              <item.icon className={cn("h-5 w-5 flex-shrink-0", isActive && "text-primary")} />
              <AnimatePresence>
                {isExpanded && (
                  <motion.span
                    className="text-sm font-medium whitespace-nowrap overflow-hidden"
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    {item.title}
                  </motion.span>
                )}
              </AnimatePresence>
            </NavLink>
          );
        })}
      </div>

      {/* Bottom section */}
      <div className="border-t border-border/30 py-3 px-2 flex flex-col gap-1">
        {/* Agency Admin — super admin only */}
        {isSuperAdmin && (
          <NavLink
            to="/agency-admin"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 min-h-[40px]",
              location.pathname === "/agency-admin"
                ? "bg-warning/15 text-warning"
                : "text-warning/70 hover:bg-warning/10 hover:text-warning"
            )}
          >
            <Shield className="h-5 w-5 flex-shrink-0" />
            <AnimatePresence>
              {isExpanded && (
                <motion.span
                  className="text-sm font-medium whitespace-nowrap overflow-hidden"
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  Agência
                </motion.span>
              )}
            </AnimatePresence>
          </NavLink>
        )}

        {bottomItems.map((item) => {
          const isActive = location.pathname === item.url;
          return (
            <NavLink
              key={item.url}
              to={item.url}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 min-h-[40px]",
                isActive
                  ? "bg-primary/15 text-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              <AnimatePresence>
                {isExpanded && (
                  <motion.span
                    className="text-sm font-medium whitespace-nowrap overflow-hidden"
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    {item.title}
                  </motion.span>
                )}
              </AnimatePresence>
            </NavLink>
          );
        })}

        {/* Logout */}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sidebar-foreground/70 hover:bg-destructive/10 hover:text-destructive min-h-[40px] w-full"
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          <AnimatePresence>
            {isExpanded && (
              <motion.span
                className="text-sm font-medium whitespace-nowrap overflow-hidden"
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
              >
                Sair
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.nav>
  );
}