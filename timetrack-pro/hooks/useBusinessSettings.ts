import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { BusinessSettings } from '@/types/database';

export function useBusinessSettings() {
  return useQuery({
    queryKey: ['businessSettings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as BusinessSettings | null;
    },
  });
}

export function useUpdateBusinessSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<BusinessSettings>) => {
      const { data: existing } = await supabase
        .from('business_settings')
        .select('id')
        .limit(1)
        .maybeSingle();

      let result;
      if (existing) {
        const { data, error } = await supabase
          .from('business_settings')
          .update(updates)
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        result = data;
      } else {
        const { data, error } = await supabase
          .from('business_settings')
          .insert(updates)
          .select()
          .single();
        if (error) throw error;
        result = data;
      }
      return result as BusinessSettings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businessSettings'] });
      queryClient.invalidateQueries({ queryKey: ['openAiKey'] });
    },
  });
}

export function useOpenAiKey() {
  return useQuery({
    queryKey: ['openAiKey'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_settings')
        .select('openai_api_key')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.openai_api_key ?? null;
    },
  });
}

export function useSaveOpenAiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (key: string | null) => {
      const { data: existing } = await supabase
        .from('business_settings')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('business_settings')
          .update({ openai_api_key: key })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('business_settings')
          .insert({ company_name: 'My Company', openai_api_key: key });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['openAiKey'] });
      queryClient.invalidateQueries({ queryKey: ['businessSettings'] });
    },
  });
}
