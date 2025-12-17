import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";

const AGENCY_SESSION_KEY = "agency_backup_session";
const SUPPORT_MODE_KEY = "support_mode_active";
const SUPPORT_ACCOUNT_KEY = "support_account_name";

interface AgencyBackupSession {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
}

interface SupportModeContext {
  isSupportMode: boolean;
  supportAccountName: string | null;
  exitSupportMode: () => Promise<void>;
  saveAgencySession: (session: Session, accountName: string) => void;
  markSupportModeActive: () => void;
}

export const useSupportMode = (): SupportModeContext => {
  const [isSupportMode, setIsSupportMode] = useState(false);
  const [supportAccountName, setSupportAccountName] = useState<string | null>(null);

  useEffect(() => {
    // Check if we're in support mode on mount
    const supportActive = localStorage.getItem(SUPPORT_MODE_KEY) === "true";
    const agencySession = localStorage.getItem(AGENCY_SESSION_KEY);
    const accountName = localStorage.getItem(SUPPORT_ACCOUNT_KEY);
    
    setIsSupportMode(supportActive && !!agencySession);
    setSupportAccountName(accountName);
  }, []);

  const saveAgencySession = useCallback((session: Session, accountName: string) => {
    const backup: AgencyBackupSession = {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
    };
    localStorage.setItem(AGENCY_SESSION_KEY, JSON.stringify(backup));
    localStorage.setItem(SUPPORT_ACCOUNT_KEY, accountName);
  }, []);

  const markSupportModeActive = useCallback(() => {
    localStorage.setItem(SUPPORT_MODE_KEY, "true");
    setIsSupportMode(true);
    setSupportAccountName(localStorage.getItem(SUPPORT_ACCOUNT_KEY));
  }, []);

  const exitSupportMode = useCallback(async () => {
    const backupSessionStr = localStorage.getItem(AGENCY_SESSION_KEY);
    
    if (!backupSessionStr) {
      console.error("No agency session backup found");
      // Clear support mode flags anyway
      localStorage.removeItem(SUPPORT_MODE_KEY);
      localStorage.removeItem(SUPPORT_ACCOUNT_KEY);
      setIsSupportMode(false);
      setSupportAccountName(null);
      // Redirect to login
      window.location.href = "/auth";
      return;
    }

    try {
      const backup: AgencyBackupSession = JSON.parse(backupSessionStr);
      
      // First sign out of current session
      await supabase.auth.signOut();
      
      // Restore agency session
      const { error } = await supabase.auth.setSession({
        access_token: backup.access_token,
        refresh_token: backup.refresh_token,
      });

      if (error) {
        console.error("Error restoring agency session:", error);
        // If session restoration fails, redirect to login
        localStorage.removeItem(AGENCY_SESSION_KEY);
        localStorage.removeItem(SUPPORT_MODE_KEY);
        localStorage.removeItem(SUPPORT_ACCOUNT_KEY);
        window.location.href = "/auth";
        return;
      }

      // Clear support mode data
      localStorage.removeItem(AGENCY_SESSION_KEY);
      localStorage.removeItem(SUPPORT_MODE_KEY);
      localStorage.removeItem(SUPPORT_ACCOUNT_KEY);
      setIsSupportMode(false);
      setSupportAccountName(null);

      // Redirect to agency admin
      window.location.href = "/agency-admin";
    } catch (err) {
      console.error("Error parsing agency backup session:", err);
      localStorage.removeItem(AGENCY_SESSION_KEY);
      localStorage.removeItem(SUPPORT_MODE_KEY);
      localStorage.removeItem(SUPPORT_ACCOUNT_KEY);
      window.location.href = "/auth";
    }
  }, []);

  return {
    isSupportMode,
    supportAccountName,
    exitSupportMode,
    saveAgencySession,
    markSupportModeActive,
  };
};

// Function to clear support mode on normal logout
export const clearSupportModeOnLogout = () => {
  localStorage.removeItem(AGENCY_SESSION_KEY);
  localStorage.removeItem(SUPPORT_MODE_KEY);
  localStorage.removeItem(SUPPORT_ACCOUNT_KEY);
};
