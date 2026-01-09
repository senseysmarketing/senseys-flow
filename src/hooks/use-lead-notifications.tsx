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
          
          // Reproduzir som de notificação
          playNotificationSound();
          
          // Mostrar toast
          toast({
            title: "🎉 Novo Lead!",
            description: `${newLead.name} foi adicionado ao CRM`,
            duration: 5000,
          });
          
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
  }, [user, enabled]);

  return {
    playNotificationSound
  };
};
