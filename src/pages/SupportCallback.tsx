import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const SUPPORT_MODE_KEY = "support_mode_active";

const SupportCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processToken = async () => {
      const tokenHash = searchParams.get("token_hash");
      const email = searchParams.get("email");
      const type = searchParams.get("type") || "magiclink";

      console.log("=== Support Callback Processing ===");
      console.log("Token hash:", tokenHash ? "present" : "missing");
      console.log("Email:", email);
      console.log("Type:", type);

      if (!tokenHash || !email) {
        console.error("Missing token_hash or email");
        setError("Link de suporte inválido. Parâmetros ausentes.");
        return;
      }

      try {
        // Use verifyOtp with token_hash to authenticate
        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as "magiclink" | "email",
        });

        console.log("VerifyOtp result:", { data, error: verifyError });

        if (verifyError) {
          console.error("VerifyOtp error:", verifyError);
          setError(`Erro ao verificar token: ${verifyError.message}`);
          return;
        }

        if (data?.session) {
          console.log("Session established successfully");
          
          // Mark support mode as active if we have a backup session
          const hasBackupSession = localStorage.getItem('agency_backup_session');
          if (hasBackupSession) {
            localStorage.setItem(SUPPORT_MODE_KEY, "true");
            console.log("Support mode activated");
          }
          
          // Redirect to dashboard after successful login
          navigate("/dashboard", { replace: true });
        } else {
          console.error("No session returned");
          setError("Não foi possível estabelecer a sessão.");
        }
      } catch (err: any) {
        console.error("Exception during token verification:", err);
        setError(`Erro inesperado: ${err.message}`);
      }
    };

    processToken();
  }, [searchParams, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 p-8">
          <div className="text-red-400 text-lg font-medium">Erro no Modo Suporte</div>
          <p className="text-muted-foreground">{error}</p>
          <button
            onClick={() => navigate("/auth")}
            className="text-primary hover:underline"
          >
            Voltar para o login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground">Autenticando sessão de suporte...</p>
      </div>
    </div>
  );
};

export default SupportCallback;
