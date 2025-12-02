import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Property {
  id: string;
  title: string;
  type: string;
  city: string | null;
}

interface PropertySelectProps {
  value: string | null;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

const PropertySelect = ({ value, onValueChange, placeholder = "Selecionar imóvel", disabled = false }: PropertySelectProps) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    try {
      const { data, error } = await supabase
        .from("properties")
        .select("id, title, type, city")
        .eq("status", "disponivel")
        .order("title");
      
      if (error) throw error;
      setProperties(data || []);
    } catch (error) {
      console.error("Erro ao buscar imóveis:", error);
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
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <SelectValue placeholder={placeholder} />
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Nenhum</SelectItem>
        {properties.map(property => (
          <SelectItem key={property.id} value={property.id}>
            {property.title}
            {property.city && ` - ${property.city}`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default PropertySelect;
