import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

interface Account {
  id: string;
  name: string;
  logo_url: string | null;
  company_name: string | null;
}

interface AccountContextType {
  account: Account | null;
  userFullName: string | null;
  loading: boolean;
  refetchAccount: () => Promise<void>;
}

const AccountContext = createContext<AccountContextType>({
  account: null,
  userFullName: null,
  loading: true,
  refetchAccount: async () => {},
});

export const useAccount = () => {
  const context = useContext(AccountContext);
  if (!context) {
    throw new Error("useAccount must be used within AccountProvider");
  }
  return context;
};

interface AccountProviderProps {
  children: ReactNode;
}

export const AccountProvider = ({ children }: AccountProviderProps) => {
  const { user } = useAuth();
  const [account, setAccount] = useState<Account | null>(null);
  const [userFullName, setUserFullName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAccount = async () => {
    if (!user) {
      setAccount(null);
      setUserFullName(null);
      setLoading(false);
      return;
    }

    try {
      // Get account_id and full_name from profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("account_id, full_name")
        .eq("user_id", user.id)
        .single();

      if (profileError) throw profileError;

      setUserFullName(profile.full_name);

      // Get account data
      const { data: accountData, error: accountError } = await supabase
        .from("accounts")
        .select("id, name, logo_url, company_name")
        .eq("id", profile.account_id)
        .single();

      if (accountError) throw accountError;

      setAccount(accountData);
    } catch (error) {
      console.error("Error fetching account:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccount();
  }, [user]);

  return (
    <AccountContext.Provider value={{ account, userFullName, loading, refetchAccount: fetchAccount }}>
      {children}
    </AccountContext.Provider>
  );
};
