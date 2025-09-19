-- Create table for custom WhatsApp message templates
CREATE TABLE public.whatsapp_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  name TEXT NOT NULL,
  template TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_templates_account_position_unique UNIQUE (account_id, position)
);

-- Enable Row Level Security
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for whatsapp_templates
CREATE POLICY "Users can manage templates from their account" 
ON public.whatsapp_templates 
FOR ALL 
USING (account_id = get_user_account_id());

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_whatsapp_templates_updated_at
BEFORE UPDATE ON public.whatsapp_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();