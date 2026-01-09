import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { signIn, resetPassword } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";
import { Mail, Lock, ArrowLeft, Sparkles, Loader2 } from "lucide-react";
import logo from "@/assets/logo-alternativa.png";
import backgroundImage from "@/assets/background-crm.jpg";

const REMEMBER_ME_KEY = 'senseys-remember-me';

const Auth = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    const saved = localStorage.getItem(REMEMBER_ME_KEY);
    return saved !== 'false'; // Default to true
  });
  const [signInData, setSignInData] = useState({
    email: "",
    password: ""
  });
  const [resetEmail, setResetEmail] = useState("");

  // Save remember me preference
  useEffect(() => {
    localStorage.setItem(REMEMBER_ME_KEY, String(rememberMe));
  }, [rememberMe]);

  useEffect(() => {
    if (user && !loading) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await signIn(signInData.email, signInData.password);
    if (error) {
      toast({
        variant: "destructive",
        title: "Erro no login",
        description: error.message
      });
    } else {
      toast({
        title: "Login realizado com sucesso!",
        description: "Redirecionando para o dashboard..."
      });
    }
    setIsLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await resetPassword(resetEmail);
    if (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message
      });
    } else {
      toast({
        title: "Email enviado!",
        description: "Verifique sua caixa de entrada para redefinir a senha."
      });
      setShowResetPassword(false);
    }
    setIsLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
          <p className="text-sm text-muted-foreground animate-pulse">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat relative overflow-hidden"
      style={{ backgroundImage: `url(${backgroundImage})` }}
    >
      {/* Overlay with gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-background/95 via-background/80 to-background/95 backdrop-blur-sm" />
      
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="w-full max-w-md space-y-8 relative z-10 animate-in">
        {/* Logo */}
        <div className="text-center space-y-4">
          <div className="relative inline-block">
            <img 
              src={logo} 
              alt="Senseys - Marketing Imobiliário" 
              className="mx-auto h-16 w-auto object-contain drop-shadow-2xl"
            />
            <Sparkles className="absolute -top-2 -right-2 h-5 w-5 text-primary animate-pulse" />
          </div>
          <p className="text-muted-foreground">Sistema de Gestão de Leads</p>
        </div>

        {showResetPassword ? (
          <Card className="glass-strong shadow-2xl border-border/50">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold">Recuperar Senha</CardTitle>
              <CardDescription>
                Digite seu email para receber as instruções
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="reset-email" 
                      type="email" 
                      value={resetEmail} 
                      onChange={e => setResetEmail(e.target.value)} 
                      className="pl-10"
                      placeholder="seu@email.com"
                      required 
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    type="submit" 
                    className="flex-1 gap-2" 
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      "Enviar"
                    )}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowResetPassword(false)}
                    className="gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card className="glass-strong shadow-2xl border-border/50">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold">Bem-vindo de volta</CardTitle>
              <CardDescription>
                Entre com suas credenciais para acessar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="signin-email" 
                      type="email" 
                      value={signInData.email} 
                      onChange={e => setSignInData({...signInData, email: e.target.value})} 
                      className="pl-10"
                      placeholder="seu@email.com"
                      required 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="signin-password" 
                      type="password" 
                      value={signInData.password} 
                      onChange={e => setSignInData({...signInData, password: e.target.value})} 
                      className="pl-10"
                      placeholder="••••••••"
                      required 
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="remember-me" 
                    checked={rememberMe} 
                    onCheckedChange={(checked) => setRememberMe(!!checked)} 
                  />
                  <Label 
                    htmlFor="remember-me" 
                    className="text-sm text-muted-foreground cursor-pointer select-none"
                  >
                    Manter conectado
                  </Label>
                </div>
                <Button 
                  type="submit" 
                  className="w-full gap-2 shadow-lg shadow-primary/20" 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    "Entrar"
                  )}
                </Button>
                <Button 
                  type="button" 
                  variant="link" 
                  className="w-full text-sm text-muted-foreground hover:text-primary" 
                  onClick={() => setShowResetPassword(true)}
                >
                  Esqueceu a senha?
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Senseys. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
};

export default Auth;
