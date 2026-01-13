import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './use-auth';
import { toast } from './use-toast';

export const useLeadNotifications = (onNewLead?: () => void, enabled: boolean = true) => {
  const { user } = useAuth();

  // Função para reproduzir som de notificação
  const playNotificationSound = useCallback(() => {
    try {
      // Criar um tom de notificação usando Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Criar oscilador para o som
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      // Conectar oscilador ao gain e ao destino
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Configurar som (duas notas para um "ding dong")
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
      
      // Configurar volume com fade out
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      // Tocar o som
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
      
    } catch (error) {
      console.log('Erro ao reproduzir som de notificação:', error);
    }
  }, []);

  useEffect(() => {
    if (!user || !enabled) {
      return;
    }

    // Configurar listener para mudanças em tempo real na tabela leads
    const channel = supabase
      .channel(`leads-changes-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'leads'
        },
        (payload) => {
          console.log('Novo lead detectado:', payload);
          
          const newLead = payload.new as any;
          
          // Check if this notification is relevant for the current user:
          // 1. Lead was assigned to this user (directed notification), OR
          // 2. Lead was not assigned to anyone (notify all as fallback)
          const isAssignedToMe = newLead.assigned_broker_id === user.id;
          const noAssignment = !newLead.assigned_broker_id;
          
          if (!isAssignedToMe && !noAssignment) {
            // Lead was assigned to someone else - don't show toast
            console.log('Lead atribuído a outro corretor, ignorando notificação toast');
            return;
          }
          
          // Reproduzir som de notificação
          playNotificationSound();
          
          // Mostrar toast com mensagem personalizada
          if (isAssignedToMe) {
            toast({
              title: "🎯 Lead Atribuído!",
              description: `${newLead.name} foi atribuído a você`,
              duration: 6000,
            });
          } else {
            toast({
              title: "🎉 Novo Lead!",
              description: `${newLead.name} foi adicionado ao CRM`,
              duration: 5000,
            });
          }
          
          // Chamar callback se fornecido
          if (onNewLead) {
            onNewLead();
          }
        }
      )
      .subscribe();

    // Cleanup na desmontagem
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, enabled, playNotificationSound, onNewLead]);

  return {
    playNotificationSound
  };
};
