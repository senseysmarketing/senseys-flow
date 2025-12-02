import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './use-auth';
import { toast } from './use-toast';

export interface OldLead {
  id: string;
  name: string;
  phone: string;
  email?: string;
  origem?: string;
  created_at: string;
  status_name: string;
  status_color?: string;
  days_since_creation: number;
}

export const useOldLeads = (daysThreshold: number = 7) => {
  const { user } = useAuth();
  const [oldLeads, setOldLeads] = useState<OldLead[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOldLeads = useCallback(async () => {
    if (!user) return;

    try {
      const now = new Date();
      const thresholdDate = new Date(now.getTime() - daysThreshold * 24 * 60 * 60 * 1000);

      // Primeiro, buscar o status_id de "Novo Lead"
      const { data: novoLeadStatus, error: statusError } = await supabase
        .from('lead_status')
        .select('id')
        .eq('name', 'Novo Lead')
        .eq('is_default', true)
        .maybeSingle();

      if (statusError) {
        console.error('Erro ao buscar status Novo Lead:', statusError);
        setLoading(false);
        return;
      }

      // Se não encontrou o status "Novo Lead", retornar lista vazia
      if (!novoLeadStatus) {
        console.log('Status "Novo Lead" não encontrado');
        setOldLeads([]);
        setLoading(false);
        return;
      }

      // Agora buscar leads que estejam no status "Novo Lead" E criados há mais de X dias
      const { data: leads, error } = await supabase
        .from('leads')
        .select(`
          id,
          name,
          phone,
          email,
          origem,
          created_at,
          status_id,
          lead_status (
            name,
            color
          )
        `)
        .eq('status_id', novoLeadStatus.id)
        .lt('created_at', thresholdDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      const oldLeadsData: OldLead[] = leads?.map(lead => {
        const createdAt = new Date(lead.created_at);
        const daysSince = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
        
        return {
          id: lead.id,
          name: lead.name,
          phone: lead.phone,
          email: lead.email,
          origem: lead.origem,
          created_at: lead.created_at,
          status_name: lead.lead_status?.name || 'Novo Lead',
          status_color: lead.lead_status?.color,
          days_since_creation: daysSince
        };
      }) || [];

      setOldLeads(oldLeadsData);
      
      // Mostrar notificação se houver leads antigos e não foi mostrada recentemente
      if (oldLeadsData.length > 0) {
        const lastNotification = localStorage.getItem('last-old-leads-notification');
        const today = new Date().toDateString();
        
        if (lastNotification !== today) {
          toast({
            title: "⚠️ Leads precisam de follow-up!",
            description: `${oldLeadsData.length} leads estão há mais de ${daysThreshold} dias como "Novo Lead"`,
            duration: 8000,
          });
          
          localStorage.setItem('last-old-leads-notification', today);
        }
      }

    } catch (error: any) {
      console.error('Erro ao carregar leads antigos:', error);
    } finally {
      setLoading(false);
    }
  }, [user, daysThreshold]);

  useEffect(() => {
    fetchOldLeads();
    
    // Atualizar a cada 30 minutos
    const interval = setInterval(fetchOldLeads, 30 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [fetchOldLeads]);

  const markLeadAsContacted = useCallback(async (leadId: string) => {
    try {
      // Buscar status "Em Contato"
      const { data: statusData, error: statusError } = await supabase
        .from('lead_status')
        .select('id')
        .eq('name', 'Em Contato')
        .maybeSingle();

      if (statusError || !statusData) {
        throw new Error('Status "Em Contato" não encontrado');
      }

      // Atualizar o lead
      const { error: updateError } = await supabase
        .from('leads')
        .update({ status_id: statusData.id })
        .eq('id', leadId);

      if (updateError) {
        throw updateError;
      }

      // Atualizar lista local
      setOldLeads(prev => prev.filter(lead => lead.id !== leadId));
      
      toast({
        title: "✅ Lead atualizado!",
        description: "Status alterado para 'Em Contato'",
      });

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar lead",
        description: error.message,
      });
    }
  }, []);

  return {
    oldLeads,
    loading,
    fetchOldLeads,
    markLeadAsContacted
  };
};
