import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  isInitializing: boolean;
  isSubmitting: boolean;
  error: string | null;
  initialize: () => () => void;
  refreshProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (params: { email: string; password: string; fullName: string; firmName?: string }) => Promise<boolean>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  isInitializing: true,
  isSubmitting: false,
  error: null,

  initialize: () => {
    supabase.auth.getSession().then(({ data }) => {
      set({ session: data.session, isInitializing: false });
      if (data.session) get().refreshProfile();
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, isInitializing: false });
      if (session) {
        get().refreshProfile();
      } else {
        set({ profile: null });
      }
    });

    return () => subscription.subscription.unsubscribe();
  },

  refreshProfile: async () => {
    const userId = get().session?.user.id;
    if (!userId) return;
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (!error && data) set({ profile: data as Profile });
  },

  signIn: async (email, password) => {
    set({ isSubmitting: true, error: null });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    set({ isSubmitting: false });
    if (error) {
      set({ error: error.message });
      return false;
    }
    return true;
  },

  signUp: async ({ email, password, fullName, firmName }) => {
    set({ isSubmitting: true, error: null });
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) {
      set({ isSubmitting: false, error: error.message });
      return false;
    }
    if (data.user && firmName) {
      await supabase.from('profiles').update({ firm_name: firmName }).eq('id', data.user.id);
    }
    set({ isSubmitting: false });
    return true;
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, profile: null });
  },

  clearError: () => set({ error: null }),
}));
