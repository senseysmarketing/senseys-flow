import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HelpCircle } from "lucide-react";

interface CustomField {
  id: string;
  field_key: string;
  name: string;
  field_type: string;
  position: number;
}

interface CustomFieldValue {
  custom_field_id: string;
  value: string | null;
}

interface LeadCustomFieldsProps {
  leadId: string;
}

const LeadCustomFields = ({ leadId }: LeadCustomFieldsProps) => {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [values, setValues] = useState<Map<string, string | null>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [leadId]);

  const fetchData = async () => {
    try {
      // Fetch custom fields for the account
      const { data: fieldsData, error: fieldsError } = await supabase
        .from("custom_fields")
        .select("id, field_key, name, field_type, position")
        .eq("is_active", true)
        .order("position", { ascending: true });

      if (fieldsError) throw fieldsError;

      // Fetch values for this lead
      const { data: valuesData, error: valuesError } = await supabase
        .from("lead_custom_field_values")
        .select("custom_field_id, value")
        .eq("lead_id", leadId);

      if (valuesError) throw valuesError;

      setFields(fieldsData || []);
      
      const valuesMap = new Map<string, string | null>();
      (valuesData || []).forEach((v: CustomFieldValue) => {
        valuesMap.set(v.custom_field_id, v.value);
      });
      setValues(valuesMap);
    } catch (error) {
      console.error("Erro ao buscar campos personalizados:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatValue = (field: CustomField, value: string | null | undefined): string => {
    if (!value) return "Sem informação";
    
    if (field.field_type === 'boolean') {
      return value === 'true' ? 'Sim' : 'Não';
    }
    
    if (field.field_type === 'date') {
      try {
        const date = new Date(value);
        return date.toLocaleDateString('pt-BR');
      } catch {
        return value;
      }
    }
    
    if (field.field_type === 'number') {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        return num.toLocaleString('pt-BR');
      }
    }
    
    return value;
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-4 bg-muted rounded w-24"></div>
        <div className="h-10 bg-muted rounded"></div>
      </div>
    );
  }

  if (fields.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
        <HelpCircle className="h-4 w-4" />
        Informações Adicionais
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {fields.map((field) => {
          const value = values.get(field.id);
          const displayValue = formatValue(field, value);
          const hasValue = value && value.trim() !== '';
          
          return (
            <div key={field.id} className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">{field.name}</p>
              <p className={`font-medium text-sm ${!hasValue ? 'text-muted-foreground italic' : ''}`}>
                {displayValue}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LeadCustomFields;
