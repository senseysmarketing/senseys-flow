import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './use-auth';
import { useAccount } from './use-account';
import { toast } from './use-toast';

interface NotificationPreferences {
  id?: string;
  email_enabled: boolean;
  push_enabled: boolean;
  sound_enabled: boolean;
  email_for_hot: boolean;
  email_for_warm: boolean;
  email_for_cold: boolean;
  notify_email: string | null;
}

const defaultPreferences: NotificationPreferences = {
  email_enabled: true,
  push_enabled: true,
  sound_enabled: true,
  email_for_hot: true,
  email_for_warm: true,
  email_for_cold: false,
  notify_email: null,
};

export const useNotificationPreferences = () => {
  const { user } = useAuth();
  const { account } = useAccount();
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchPreferences = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setPreferences({
          id: data.id,
          email_enabled: data.email_enabled ?? true,
          push_enabled: data.push_enabled ?? true,
          sound_enabled: data.sound_enabled ?? true,
          email_for_hot: data.email_for_hot ?? true,
          email_for_warm: data.email_for_warm ?? true,
          email_for_cold: data.email_for_cold ?? false,
          notify_email: data.notify_email,
        });
      } else {
        // Set user email as default notify email
        setPreferences({
          ...defaultPreferences,
          notify_email: user.email || null,
        });
      }
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const savePreferences = async (newPreferences: Partial<NotificationPreferences>) => {
    if (!user || !account?.id) return;

    setSaving(true);
    try {
      const updatedPreferences = { ...preferences, ...newPreferences };
      
      if (preferences.id) {
        // Update existing
        const { error } = await supabase
          .from('notification_preferences')
          .update({
            email_enabled: updatedPreferences.email_enabled,
            push_enabled: updatedPreferences.push_enabled,
            sound_enabled: updatedPreferences.sound_enabled,
            email_for_hot: updatedPreferences.email_for_hot,
            email_for_warm: updatedPreferences.email_for_warm,
            email_for_cold: updatedPreferences.email_for_cold,
            notify_email: updatedPreferences.notify_email,
            updated_at: new Date().toISOString(),
          })
          .eq('id', preferences.id);

        if (error) throw error;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('notification_preferences')
          .insert({
            user_id: user.id,
            account_id: account.id,
            email_enabled: updatedPreferences.email_enabled,
            push_enabled: updatedPreferences.push_enabled,
            sound_enabled: updatedPreferences.sound_enabled,
            email_for_hot: updatedPreferences.email_for_hot,
            email_for_warm: updatedPreferences.email_for_warm,
            email_for_cold: updatedPreferences.email_for_cold,
            notify_email: updatedPreferences.notify_email,
          })
          .select()
          .single();

        if (error) throw error;
        updatedPreferences.id = data.id;
      }

      setPreferences(updatedPreferences as NotificationPreferences);
      toast({
        title: "Preferências salvas",
        description: "Suas preferências de notificação foram atualizadas.",
      });
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar suas preferências.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return {
    preferences,
    loading,
    saving,
    savePreferences,
    refetch: fetchPreferences,
  };
};
