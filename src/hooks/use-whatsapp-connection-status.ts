import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Centralized hook to get the verified WhatsApp connection status.
 * 
 * Instead of trusting DB status blindly (which can be stale as 'connecting'),
 * this hook:
 * 1. Reads DB status first
 * 2. If status is NOT 'connected', calls whatsapp-connect?action=status to reconcile
 * 3. Returns the real verified status
 */
export function useVerifiedWhatsAppStatus(accountId: string | undefined | null) {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const verify = useCallback(async () => {
    if (!accountId) {
      setIsConnected(null);
      setLoading(false);
      return;
    }

    // Step 1: Check DB
    const { data: session } = await supabase
      .from('whatsapp_sessions')
      .select('status')
      .eq('account_id', accountId)
      .maybeSingle();

    if (!session) {
      // No session at all
      setIsConnected(false);
      setLoading(false);
      return;
    }

    if (session.status === 'connected') {
      setIsConnected(true);
      setLoading(false);
      return;
    }

    // Step 2: DB says connecting/disconnected/qr_ready — verify with Evolution
    try {
      const response = await supabase.functions.invoke('whatsapp-connect?action=status');

      if (response.error) {
        // Try refreshing auth and retry once
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError) {
          const retry = await supabase.functions.invoke('whatsapp-connect?action=status');
          if (!retry.error && retry.data?.connected) {
            setIsConnected(true);
            setLoading(false);
            return;
          }
        }
        // Could not verify — trust DB
        setIsConnected(false);
        setLoading(false);
        return;
      }

      if (response.data?.connected) {
        setIsConnected(true);
      } else {
        setIsConnected(false);
      }
    } catch {
      setIsConnected(false);
    }

    setLoading(false);
  }, [accountId]);

  useEffect(() => {
    verify();
  }, [verify]);

  return { isConnected, loading, refetch: verify };
}
