import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * Yönetici paneli verileri — yalnız is_admin kullanıcılar içindir. Sunucudaki
 * SECURITY DEFINER RPC'ler (admin_overview / admin_recent_users /
 * admin_set_premium) her çağrıda çağıranın admin olduğunu doğrular; admin
 * olmayan istek 'not_admin' hatasıyla döner.
 */

export interface AdminOverview {
  total_users: number;
  premium_users: number;
  new_today: number;
  new_week: number;
  new_month: number;
  active_week: number;
  total_cases: number;
  total_clients: number;
  total_hearings: number;
}

export interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  firm_name: string | null;
  is_premium: boolean;
  created_at: string;
  last_sign_in_at: string | null;
}

export function useAdminOverview() {
  return useQuery({
    queryKey: ['admin', 'overview'],
    staleTime: 30_000,
    queryFn: async (): Promise<AdminOverview> => {
      const { data, error } = await supabase.rpc('admin_overview');
      if (error) throw error;
      return data as AdminOverview;
    },
  });
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin', 'users'],
    staleTime: 30_000,
    queryFn: async (): Promise<AdminUser[]> => {
      const { data, error } = await supabase.rpc('admin_recent_users', { p_limit: 100 });
      if (error) throw error;
      return (data ?? []) as AdminUser[];
    },
  });
}

export function useSetPremium() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, value }: { userId: string; value: boolean }) => {
      const { error } = await supabase.rpc('admin_set_premium', { p_user_id: userId, p_value: value });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] });
    },
  });
}
