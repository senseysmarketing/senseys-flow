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
import { useSuperAdmin } from "@/hooks/use-super-admin";
import { usePermissions } from "@/hooks/use-permissions";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import logoAlternativaBranca from "@/assets/logo-alternativa-branca.png";
import logoIcon from "@/assets/logo-icon.png";

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

  if (isMobile) return null;

  const logoSrc = account?.logo_url || logoAlternativaBranca;

  return (
    <motion.nav
      className="fixed left-0 top-0 h-screen z-50 flex flex-col bg-[#1e1e20] border-r border-white/5 overflow-hidden"
      initial={false}
      animate={{ width: isExpanded ? 200 : 64 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* Logo */}
      <div className="flex items-center justify-center px-3 py-4 border-b border-white/5">
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
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 relative group min-h-[40px]",
                isActive
                  ? "bg-white/5 text-white"
                  : "text-[#a6c8e1] hover:bg-white/5 hover:text-white"
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-[#81afd1]" />
              )}
              <item.icon className={cn("h-5 w-5 flex-shrink-0", isActive && "text-[#81afd1]")} />
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
      <div className="border-t border-white/5 py-3 px-2 flex flex-col gap-1">
        {isSuperAdmin && (
          <NavLink
            to="/agency-admin"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 min-h-[40px]",
              location.pathname === "/agency-admin"
                ? "bg-white/5 text-[#81afd1]"
                : "text-[#81afd1]/70 hover:bg-white/5 hover:text-[#81afd1]"
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
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 min-h-[40px]",
                isActive
                  ? "bg-white/5 text-white"
                  : "text-[#a6c8e1] hover:bg-white/5 hover:text-white"
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
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-[#a6c8e1] hover:bg-white/5 hover:text-red-400 min-h-[40px] w-full"
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
