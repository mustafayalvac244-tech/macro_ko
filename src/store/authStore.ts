import { create } from 'zustand';
import { File } from 'expo-file-system';
import type { Session } from '@supabase/supabase-js';
import { DOCUMENTS_BUCKET, supabase } from '@/lib/supabase';
import { trError } from '@/lib/authErrors';
import type { Profile } from '@/types/database';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  isInitializing: boolean;
  isSubmitting: boolean;
  error: string | null;
  initialize: () => () => void;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<Profile, 'full_name' | 'firm_name' | 'bar_number' | 'phone'>>) => Promise<void>;
  uploadAvatar: (file: { uri: string; mimeType: string | null }) => Promise<void>;
  removeAvatar: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (params: { email: string; password: string; fullName: string; firmName?: string }) => Promise<boolean>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
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

  updateProfile: async (patch) => {
    const userId = get().session?.user.id;
    if (!userId) return;
    const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
    if (error) throw error;
    await get().refreshProfile();
  },

  uploadAvatar: async (file) => {
    const userId = get().session?.user.id;
    if (!userId) return;
    const oldPath = get().profile?.avatar_url;

    const bytes = await new File(file.uri).arrayBuffer();
    const ext = file.mimeType?.includes('png') ? 'png' : 'jpg';
    const path = `${userId}/profile/avatar-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(path, bytes, { contentType: file.mimeType ?? 'image/jpeg' });
    if (uploadError) throw uploadError;

    const { error } = await supabase.from('profiles').update({ avatar_url: path }).eq('id', userId);
    if (error) throw error;

    if (oldPath) {
      await supabase.storage.from(DOCUMENTS_BUCKET).remove([oldPath]).catch(() => {});
    }
    await get().refreshProfile();
  },

  removeAvatar: async () => {
    const userId = get().session?.user.id;
    const oldPath = get().profile?.avatar_url;
    if (!userId) return;
    const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', userId);
    if (error) throw error;
    if (oldPath) {
      await supabase.storage.from(DOCUMENTS_BUCKET).remove([oldPath]).catch(() => {});
    }
    await get().refreshProfile();
  },

  signIn: async (email, password) => {
    set({ isSubmitting: true, error: null });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    set({ isSubmitting: false });
    if (error) {
      set({ error: trError(error.message) });
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
      set({ isSubmitting: false, error: trError(error.message) });
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

  deleteAccount: async () => {
    const userId = get().session?.user.id;
    if (!userId) return;

    // Delete uploaded files from storage first (DB cascade doesn't remove them).
    const { data: docs } = await supabase.from('documents').select('file_path').eq('owner_id', userId);
    const paths = (docs ?? []).map((d: { file_path: string }) => d.file_path);
    if (paths.length > 0) {
      await supabase.storage.from(DOCUMENTS_BUCKET).remove(paths).catch(() => {});
    }

    // Server-side function deletes the auth user; every table cascades from it.
    const { error } = await supabase.rpc('delete_account');
    if (error) throw error;

    await supabase.auth.signOut().catch(() => {});
    set({ session: null, profile: null });
  },

  clearError: () => set({ error: null }),
}));
