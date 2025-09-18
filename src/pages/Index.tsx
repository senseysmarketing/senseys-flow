import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-6 max-w-2xl mx-auto px-4">
        <div className="space-y-4">
          <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Senseys CRM
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground">
            Marketing Imobiliário
          </p>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Sistema completo de gestão de leads para imobiliárias e corretores. 
            Organize seus leads, acompanhe o funil de vendas e aumente suas conversões.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button 
            size="lg" 
            onClick={() => navigate('/auth')}
            className="gap-2"
          >
            Acessar Sistema
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button 
            size="lg" 
            variant="outline"
            onClick={() => navigate('/auth')}
          >
            Criar Conta
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto">
              <ArrowRight className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold">Gestão de Leads</h3>
            <p className="text-sm text-muted-foreground">
              Organize e acompanhe todos os seus leads em um só lugar
            </p>
          </div>
          
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto">
              <ArrowRight className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold">Funil de Vendas</h3>
            <p className="text-sm text-muted-foreground">
              Visualize o progresso dos leads no processo de venda
            </p>
          </div>
          
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto">
              <ArrowRight className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold">Relatórios</h3>
            <p className="text-sm text-muted-foreground">
              Análises detalhadas para melhorar sua performance
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
