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
  ai_cost_month: number;
}

export interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  firm_name: string | null;
  is_premium: boolean;
  ai_tier: string;
  ai_cost_try: number;
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

/**
 * AI iş özeti — kontör, kâr, iade oranı ve hangi modelin cevapladığı.
 *
 * NEDEN AYRI SORGU. Bu oturumda kontör, ücret/maliyet ayrımı, iade ve günlük
 * adil kullanım eklendi; hiçbiri panelde görünmüyordu. Görünmeyen bir iş modeli
 * yönetilemez: "bugün kaç istek geçti", "ne kazandık", "kaç iade geldi",
 * "hangi model cevaplıyor" sorularının cevabı olmadan ne fiyat ayarlanabilir ne
 * de kalite sorunu fark edilebilir.
 */
export interface AdminAiOzeti {
  bugun_istek: number;
  bugun_token: number;
  ay_istek: number;
  ay_gider_try: number;
  ay_satis_try: number;
  ay_kar_try: number;
  ay_iade: number;
  ay_toplam_istek: number;
  /** İade oranı (%). Ölçüm senaryolarını biz yazıyoruz; iade, gerçek dosyada
   *  işe yaramadığını gören avukatın sözü — kalitenin en dürüst göstergesi. */
  iade_orani: number;
  iade_dagilim: Array<{ mod: string; iade: number; toplam: number }>;
  /** Yüklenmiş ve henüz harcanmamış kontör: gelir değil, ÖDENMİŞ BORÇ. */
  kontor_bakiye: number;
  saglayicilar: Array<{ saglayici: string; sonuc: string; model: string | null; zaman: string }>;
}

export function useAdminAiOzeti() {
  return useQuery({
    queryKey: ['admin', 'ai-ozeti'],
    staleTime: 30_000,
    queryFn: async (): Promise<AdminAiOzeti> => {
      const { data, error } = await supabase.rpc('admin_ai_ozeti');
      if (error) throw error;
      return data as AdminAiOzeti;
    },
  });
}
