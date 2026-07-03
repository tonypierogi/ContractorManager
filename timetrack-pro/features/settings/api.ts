import { supabase } from '@/lib/supabase';
import type { BusinessSettings } from '@/types/database';

export async function fetchBusinessSettings(): Promise<BusinessSettings | null> {
  const { data, error } = await supabase
    .from('business_settings')
    .select('*')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as BusinessSettings | null;
}

export async function updateBusinessSettings(
  updates: Partial<BusinessSettings>,
): Promise<BusinessSettings> {
  const { data: existing } = await supabase
    .from('business_settings')
    .select('id')
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from('business_settings')
      .update(updates)
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data as BusinessSettings;
  }

  const { data, error } = await supabase
    .from('business_settings')
    .insert(updates)
    .select()
    .single();
  if (error) throw error;
  return data as BusinessSettings;
}

export async function fetchOpenAiKey(): Promise<string | null> {
  const { data, error } = await supabase
    .from('business_settings')
    .select('openai_api_key')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.openai_api_key ?? null;
}

export async function saveOpenAiKey(key: string | null): Promise<void> {
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
}
