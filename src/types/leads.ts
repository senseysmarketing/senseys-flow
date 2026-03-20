import { z } from "zod";

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email?: string;
  interesse?: string;
  observacoes?: string;
  origem?: string;
  campanha?: string;
  conjunto?: string;
  anuncio?: string;
  meta_campaign_name?: string | null;
  meta_ad_name?: string | null;
  meta_campaign_id?: string | null;
  meta_ad_id?: string | null;
  meta_form_id?: string | null;
  meta_lead_id?: string | null;
  is_duplicate?: boolean;
  duplicate_of_lead_id?: string | null;
  created_at: string;
  updated_at: string;
  status_id?: string;
  temperature?: string | null;
  assigned_broker_id?: string | null;
  property_id?: string | null;
  account_id?: string;
  lead_status?: {
    name: string;
    color: string;
  };
  properties?: {
    id: string;
    title: string;
  } | null;
}

export interface LeadStatus {
  id: string;
  name: string;
  color: string;
  position: number;
  is_system?: boolean;
  is_default?: boolean | null;
}

export const leadFormSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  phone: z.string().min(1, "Telefone é obrigatório"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  interesse: z.string().optional(),
  observacoes: z.string().optional(),
  origem: z.string().optional(),
  campanha: z.string().optional(),
  conjunto: z.string().optional(),
  anuncio: z.string().optional(),
  status_id: z.string().optional(),
  temperature: z.enum(["hot", "warm", "cold"]).default("warm"),
  assigned_broker_id: z.string().nullable().optional(),
  property_id: z.string().nullable().optional(),
});

export type LeadFormValues = z.infer<typeof leadFormSchema>;
