import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Broker {
  user_id: string;
  full_name: string | null;
}

interface BrokerSelectProps {
  value: string | null;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

const BrokerSelect = ({ value, onValueChange, placeholder = "Selecionar corretor", disabled = false }: BrokerSelectProps) => {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBrokers();
  }, []);

  const fetchBrokers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .order("full_name");
      
      if (error) throw error;
      setBrokers(data || []);
    } catch (error) {
      console.error("Erro ao buscar corretores:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Select
      value={value || "none"}
      onValueChange={v => onValueChange(v === "none" ? null : v)}
      disabled={disabled || loading}
    >
      <SelectTrigger>
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <SelectValue placeholder={placeholder} />
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Nenhum</SelectItem>
        {brokers.map(broker => (
          <SelectItem key={broker.user_id} value={broker.user_id}>
            {broker.full_name || "Sem nome"}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default BrokerSelect;
