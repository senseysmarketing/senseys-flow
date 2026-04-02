import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Function to recover session from backup storage
  const recoverSession = useCallback(async () => {
    try {
      // Try to get session from backup (sessionStorage)
      const backupToken = sessionStorage.getItem('sb-ujodxlzlfvdwqufkgdnw-auth-token');
      if (backupToken) {
        const parsed = JSON.parse(backupToken);
        if (parsed?.access_token && parsed?.refresh_token) {
          console.log('Attempting session recovery from backup...');
          const { data, error } = await supabase.auth.setSession({
            access_token: parsed.access_token,
            refresh_token: parsed.refresh_token
          });
          if (!error && data.session) {
            console.log('Session recovered successfully');
            setSession(data.session);
            setUser(data.session.user);
            return true;
          }
        }
      }
    } catch (e) {
      console.log('Session recovery failed:', e);
    }
    return false;
  }, []);

  // Handle visibility change (app comes back to foreground)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log('App returned to foreground, checking session...');
        
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.log('Session check error:', error.message);
          
          // If refresh token not found, try to recover from backup
          if (error.message?.includes('refresh_token_not_found') || 
              error.message?.includes('Invalid Refresh Token')) {
            const recovered = await recoverSession();
            if (!recovered && session) {
              console.log('Could not recover session, user will need to re-login');
            }
          }
        } else if (currentSession) {
          // Only update state if user actually changed to avoid unnecessary re-renders
          if (currentSession.user?.id !== user?.id) {
            setSession(currentSession);
            setUser(currentSession.user);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [session, recoverSession]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.log('Initial session error:', error.message);
        // Try to recover on initial load if there's an error
        recoverSession().finally(() => setLoading(false));
      } else {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [recoverSession]);

  return (
    <AuthContext.Provider value={{ user, session, loading }}>
      {children}
    </AuthContext.Provider>
  );
};