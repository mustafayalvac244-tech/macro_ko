import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';

export interface DashboardStats {
  activeCases: number;
  totalClients: number;
  upcomingHearings: number;
  openDeadlines: number;
}

export function useDashboardStats() {
  const ownerId = useAuthStore((s) => s.session?.user.id);

  return useQuery({
    queryKey: ['dashboard-stats', ownerId],
    enabled: !!ownerId,
    queryFn: async (): Promise<DashboardStats> => {
      const nowIso = new Date().toISOString();

      const [activeCases, totalClients, upcomingHearings, openDeadlines] = await Promise.all([
        supabase
          .from('cases')
          .select('id', { count: 'exact', head: true })
          .eq('owner_id', ownerId!)
          .in('status', ['active', 'pending', 'on_hold']),
        supabase.from('clients').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId!),
        supabase
          .from('hearings')
          .select('id', { count: 'exact', head: true })
          .eq('owner_id', ownerId!)
          .eq('is_completed', false)
          .gte('scheduled_at', nowIso),
        supabase
          .from('deadlines')
          .select('id', { count: 'exact', head: true })
          .eq('owner_id', ownerId!)
          .eq('is_completed', false),
      ]);

      return {
        activeCases: activeCases.count ?? 0,
        totalClients: totalClients.count ?? 0,
        upcomingHearings: upcomingHearings.count ?? 0,
        openDeadlines: openDeadlines.count ?? 0,
      };
    },
  });
}
