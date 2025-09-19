import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './use-auth';
import { toast } from './use-toast';

export const useLeadNotifications = (onNewLead?: () => void) => {
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

  // Função para mostrar notificação do navegador
  const showBrowserNotification = useCallback((leadName: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Novo Lead!', {
        body: `${leadName} foi adicionado ao CRM`,
        icon: '/favicon.ico',
        badge: '/favicon.ico'
      });
    }
  }, []);

  // Solicitar permissão para notificações
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    // Solicitar permissão para notificações quando o hook for usado
    requestNotificationPermission();

    // Configurar listener para mudanças em tempo real na tabela leads
    const channel = supabase
      .channel('leads-changes')
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
          
          // Mostrar notificação do navegador
          showBrowserNotification(newLead.name);
          
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
  }, [user, playNotificationSound, showBrowserNotification, onNewLead, requestNotificationPermission]);

  return {
    playNotificationSound,
    requestNotificationPermission
  };
};