import { useState, useEffect, useCallback } from "react";
import { X, Download, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFirebaseMessaging } from "@/hooks/use-firebase-messaging";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

type BannerType = "install" | "notifications" | null;

function isDismissed(key: string): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    const timestamp = parseInt(raw, 10);
    return Date.now() - timestamp < DISMISS_DURATION_MS;
  } catch {
    return false;
  }
}

function dismiss(key: string) {
  localStorage.setItem(key, Date.now().toString());
}

export default function SmartBanner() {
  const { isSubscribed, isLoading, permissionState, subscribe } = useFirebaseMessaging();
  const isMobile = useIsMobile();
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isPWA, setIsPWA] = useState(false);
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [acting, setActing] = useState(false);

  // Detect PWA
  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)");
    setIsPWA(mq.matches || (navigator as any).standalone === true);
    const handler = (e: MediaQueryListEvent) => setIsPWA(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Listen for beforeinstallprompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Determine banner type
  const getBannerType = useCallback((): BannerType => {
    if (isLoading) return null;

    // Mobile + not PWA → install banner
    if (isMobile && !isPWA) {
      if (isDismissed("smart-banner-dismissed-install")) return null;
      return "install";
    }

    // Notifications already active → no banner
    if (isSubscribed || permissionState === "denied") return null;

    // PWA or desktop → notification banner
    if (isDismissed("smart-banner-dismissed-notifications")) return null;
    return "notifications";
  }, [isMobile, isPWA, isSubscribed, isLoading, permissionState]);

  const bannerType = getBannerType();

  // Show with delay for smoother UX
  useEffect(() => {
    if (bannerType) {
      const timer = setTimeout(() => setVisible(true), 2000);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [bannerType]);

  const handleDismiss = useCallback(() => {
    setClosing(true);
    const key = bannerType === "install"
      ? "smart-banner-dismissed-install"
      : "smart-banner-dismissed-notifications";
    dismiss(key);
    setTimeout(() => {
      setVisible(false);
      setClosing(false);
    }, 300);
  }, [bannerType]);

  const handleAction = useCallback(async () => {
    setActing(true);
    try {
      if (bannerType === "install" && installPrompt) {
        await installPrompt.prompt();
        const result = await installPrompt.userChoice;
        if (result.outcome === "accepted") {
          setVisible(false);
        }
        setInstallPrompt(null);
      } else if (bannerType === "notifications") {
        const success = await subscribe();
        if (success) {
          setClosing(true);
          setTimeout(() => setVisible(false), 300);
        }
      }
    } finally {
      setActing(false);
    }
  }, [bannerType, installPrompt, subscribe]);

  if (!visible || !bannerType) return null;

  const isInstall = bannerType === "install";

  return (
    <div
      className={cn(
        "fixed z-50 right-4 w-[340px] max-w-[calc(100vw-2rem)]",
        "bg-card border border-border rounded-xl shadow-lg",
        "transition-all duration-300 ease-out",
        closing
          ? "opacity-0 translate-y-4"
          : "opacity-100 translate-y-0 animate-in slide-in-from-bottom-4 fade-in",
        isMobile ? "bottom-20" : "bottom-4"
      )}
    >
      <div className="p-4">
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex gap-3">
          {/* Icon */}
          <div className="flex-shrink-0 mt-0.5">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              {isInstall ? (
                <Download className="h-5 w-5 text-primary" />
              ) : (
                <Bell className="h-5 w-5 text-primary" />
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 pr-4">
            <h4 className="text-sm font-semibold text-foreground">
              {isInstall ? "Instale o CRM Senseys" : "Ative as Notificações"}
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              {isInstall
                ? "Acesse mais rápido direto da tela inicial do seu celular."
                : "Receba alertas instantâneos de novos leads e mensagens."}
            </p>

            {/* Actions */}
            <div className="flex items-center gap-2 mt-3">
              <Button
                size="sm"
                onClick={handleAction}
                disabled={acting || (isInstall && !installPrompt)}
                className="h-8 text-xs px-4"
              >
                {acting
                  ? "Aguarde..."
                  : isInstall
                    ? "Instalar"
                    : "Ativar Agora"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="h-8 text-xs px-3 text-muted-foreground"
              >
                Depois
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
