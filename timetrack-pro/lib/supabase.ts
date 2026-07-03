import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { Env } from '@/lib/env';

export const EDGE_FUNCTION_URL = `${Env.supabaseUrl}/functions/v1`;

const LocalStorageAdapter = {
  getItem: (key: string) => {
    if (typeof localStorage === 'undefined') return Promise.resolve(null);
    return Promise.resolve(localStorage.getItem(key));
  },
  setItem: (key: string, value: string) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
    return Promise.resolve();
  },
  removeItem: (key: string) => {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
    return Promise.resolve();
  },
};

export const supabase = createClient(Env.supabaseUrl, Env.supabaseAnonKey, {
  auth: {
    // AsyncStorage on native: Supabase session JSON exceeds SecureStore's 2048-byte
    // per-value limit, which silently truncates and causes random logouts.
    storage: Platform.OS === 'web' ? LocalStorageAdapter : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
