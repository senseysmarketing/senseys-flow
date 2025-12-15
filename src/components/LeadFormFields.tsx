import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FormInput } from "lucide-react";

interface FormFieldValue {
  field_name: string;
  field_label: string | null;
  field_value: string | null;
}

interface LeadFormFieldsProps {
  leadId: string;
}

const LeadFormFields = ({ leadId }: LeadFormFieldsProps) => {
  const [formFields, setFormFields] = useState<FormFieldValue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFormFields = async () => {
      try {
        const { data, error } = await supabase
          .from('lead_form_field_values')
          .select('field_name, field_label, field_value')
          .eq('lead_id', leadId)
          .order('field_name');

        if (error) throw error;
        setFormFields(data || []);
      } catch (error) {
        console.error('Error fetching form fields:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFormFields();
  }, [leadId]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-4 bg-muted rounded w-1/3"></div>
        <div className="h-8 bg-muted rounded"></div>
      </div>
    );
  }

  if (formFields.length === 0) {
    return null;
  }

  const formatValue = (value: string | null): string => {
    if (!value) return 'Sem informação';
    
    // Handle boolean values in Portuguese
    const lowerValue = value.toLowerCase();
    if (['sim', 'yes', 'true', '1', 'verdadeiro'].includes(lowerValue)) return 'Sim';
    if (['não', 'nao', 'no', 'false', '0', 'falso'].includes(lowerValue)) return 'Não';
    
    return value;
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
        <FormInput className="h-4 w-4" />
        Dados do Formulário
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {formFields.map((field, index) => (
          <div key={index} className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground mb-1">
              {field.field_label || field.field_name}
            </p>
            <p className="text-sm font-medium">
              {formatValue(field.field_value)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LeadFormFields;
