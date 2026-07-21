import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  source?: string;
}

// Duruşma planı cihazda saklanır — hiçbir sunucu kurulumu (SQL) gerektirmez.
// React Query önbelleği de kalıcı olduğundan çevrimdışı da erişilir.
const keyFor = (caseId: string) => `VEKIL_WARPLAN_${caseId}`;

export function useBrief(caseId: string | undefined) {
  return useQuery({
    queryKey: ['brief', caseId],
    enabled: !!caseId,
    queryFn: async () => {
      try {
        const raw = await AsyncStorage.getItem(keyFor(caseId!));
        return raw ? { content: JSON.parse(raw) as WarPlanContent } : null;
      } catch {
        return null;
      }
    },
  });
}

export function useSaveBrief() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ caseId, content }: { caseId: string; content: WarPlanContent }) => {
      await AsyncStorage.setItem(keyFor(caseId), JSON.stringify(content));
    },
    onSuccess: (_d, v) => queryClient.invalidateQueries({ queryKey: ['brief', v.caseId] }),
  });
}
