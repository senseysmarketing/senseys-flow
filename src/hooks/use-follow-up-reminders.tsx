import { useEffect, useCallback, useState } from 'react';
import { useOldLeads } from './use-old-leads';
import { toast } from './use-toast';
import type { FollowUpSettingsType } from '@/components/FollowUpSettings';

export const useFollowUpReminders = (defaultSettings: Partial<FollowUpSettingsType> = {}) => {
  const [settings, setSettings] = useState<FollowUpSettingsType>({
    enabled: true,
    intervalMinutes: 120,
    daysThreshold: 7,
    showUrgentOnly: false,
    ...defaultSettings
  });

  // Carregar configurações salvas
  useEffect(() => {
    const savedSettings = localStorage.getItem('followup-settings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setSettings(parsed);
    }
  }, []);

  const { oldLeads } = useOldLeads(settings.daysThreshold);

  // Função para mostrar lembrete
  const showReminder = useCallback(() => {
    if (oldLeads.length === 0) return;

    const highPriorityLeads = oldLeads.filter(lead => lead.days_since_creation >= 14);
    const regularLeads = oldLeads.filter(lead => lead.days_since_creation < 14);

    // Se configurado para apenas urgentes, só mostrar se houver leads urgentes
    if (settings.showUrgentOnly && highPriorityLeads.length === 0) {
      return;
    }

    if (highPriorityLeads.length > 0) {
      toast({
        title: "🚨 URGENTE: Leads há mais de 14 dias!",
        description: `${highPriorityLeads.length} leads precisam de follow-up URGENTE`,
        duration: 10000,
      });
    } else if (regularLeads.length > 0 && !settings.showUrgentOnly) {
      toast({
        title: "⏰ Lembrete de Follow-up",
        description: `${regularLeads.length} leads aguardando contato há mais de ${settings.daysThreshold} dias`,
        duration: 6000,
      });
    }
  }, [oldLeads, settings.daysThreshold, settings.showUrgentOnly]);

  // Configurar lembretes automáticos
  useEffect(() => {
    if (!settings.enabled || oldLeads.length === 0) return;

    const intervalMs = settings.intervalMinutes * 60 * 1000;
    
    // Verificar se já passou tempo suficiente desde o último lembrete
    const lastReminderKey = 'last-followup-reminder';
    const lastReminder = localStorage.getItem(lastReminderKey);
    const now = Date.now();
    
    if (!lastReminder || (now - parseInt(lastReminder)) >= intervalMs) {
      showReminder();
      localStorage.setItem(lastReminderKey, now.toString());
    }

    // Configurar próximo lembrete
    const interval = setInterval(() => {
      showReminder();
      localStorage.setItem(lastReminderKey, Date.now().toString());
    }, intervalMs);

    return () => clearInterval(interval);
  }, [settings.enabled, settings.intervalMinutes, oldLeads.length, showReminder]);

  // Função para configurar lembretes personalizados
  const scheduleCustomReminder = useCallback((minutes: number) => {
    setTimeout(() => {
      if (oldLeads.length > 0) {
        toast({
          title: "⏰ Lembrete Personalizado",
          description: `Você tem ${oldLeads.length} leads aguardando follow-up`,
          duration: 8000,
        });
      }
    }, minutes * 60 * 1000);
  }, [oldLeads.length]);

  return {
    scheduleCustomReminder,
    showReminder,
    oldLeadsCount: oldLeads.length,
    highPriorityCount: oldLeads.filter(lead => lead.days_since_creation >= 14).length,
    settings
  };
};