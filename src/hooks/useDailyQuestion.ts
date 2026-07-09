import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { getTodayQuestion } from '@/constants/dailyQuestions';
import type { PublicProfile } from '@/types/database';

export interface QuestionAnswer {
  id: string;
  user_id: string;
  question_key: string;
  body: string;
  points: number;
  created_at: string;
  profile?: PublicProfile | null;
}

/** Whether the signed-in user already answered today. */
export function useMyAnswerToday() {
  const me = useAuthStore((s) => s.session?.user.id);
  const question = getTodayQuestion();

  return useQuery({
    queryKey: ['qa', 'mine', me, question.key],
    enabled: !!me,
    retry: (n, e) => {
      const err = e as { code?: string } | null;
      return err?.code !== '42P01' && err?.code !== 'PGRST205' && n < 1;
    },
    queryFn: async () => {
      const { data, error } = await supabase
        .from('question_answers')
        .select('*')
        .eq('user_id', me!)
        .eq('question_key', question.key)
        .maybeSingle();
      if (error) throw error;
      return data as QuestionAnswer | null;
    },
  });
}

export function useSubmitAnswer() {
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.session?.user.id);
  const question = getTodayQuestion();

  return useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase
        .from('question_answers')
        .insert({ user_id: me!, question_key: question.key, body: body.trim(), points: 100 });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['qa'] }),
  });
}

/** All-time leaderboard: sum of points per user. */
export function useLeaderboard(limit = 4) {
  return useQuery({
    queryKey: ['qa', 'leaderboard', limit],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('question_answers')
        .select('user_id, points, profile:profiles(id, full_name, firm_name, bar_number, avatar_url)')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      const rows = data as unknown as Array<{ user_id: string; points: number; profile: PublicProfile | null }>;
      const totals = new Map<string, { profile: PublicProfile | null; points: number }>();
      rows.forEach((r) => {
        const entry = totals.get(r.user_id);
        if (entry) entry.points += r.points;
        else totals.set(r.user_id, { profile: r.profile, points: r.points });
      });
      return Array.from(totals.entries())
        .map(([user_id, v]) => ({ user_id, ...v }))
        .sort((a, b) => b.points - a.points)
        .slice(0, limit);
    },
  });
}
