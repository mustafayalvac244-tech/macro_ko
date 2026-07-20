import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';

export interface BriefSections {
  acilis: string;
  dayanaklar: string;
  tanik: string;
  karsi: string;
  sonrasi: string;
}

export interface WarPlanContent {
  brief?: Partial<BriefSections>;
  checklist?: Record<string, boolean>;
  notes?: Array<{ at: string; text: string }>;
  debrief?: { good?: string; bad?: string };
  /** 'ai' | 'template' — brief'in nasıl üretildiği */
  source?: string;
}

export interface DurusmaBrief {
  id: string;
  owner_id: string;
  case_id: string;
  content: WarPlanContent;
  updated_at: string;
  created_at: string;
}

/** True when the 0023 (durusma_briefs) section of KURULUM.sql hasn't run. */
export function isMissingBriefTable(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  if (!e) return false;
  if (e.code === '42P01' || e.code === 'PGRST205') return true;
  return (e.message ?? '').toLowerCase().includes('durusma_briefs');
}

export function useBrief(caseId: string | undefined) {
  return useQuery({
    queryKey: ['brief', caseId],
    enabled: !!caseId,
    retry: (n, err) => !isMissingBriefTable(err) && n < 1,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('durusma_briefs')
        .select('*')
        .eq('case_id', caseId!)
        .maybeSingle();
      if (error) throw error;
      return (data as DurusmaBrief | null) ?? null;
    },
  });
}

export function useSaveBrief() {
  const queryClient = useQueryClient();
  const ownerId = useAuthStore((s) => s.session?.user.id);

  return useMutation({
    mutationFn: async ({ caseId, content }: { caseId: string; content: WarPlanContent }) => {
      const { error } = await supabase
        .from('durusma_briefs')
        .upsert(
          { owner_id: ownerId!, case_id: caseId, content, updated_at: new Date().toISOString() },
          { onConflict: 'case_id' }
        );
      if (error) throw error;
    },
    onSuccess: (_d, v) => queryClient.invalidateQueries({ queryKey: ['brief', v.caseId] }),
  });
}
