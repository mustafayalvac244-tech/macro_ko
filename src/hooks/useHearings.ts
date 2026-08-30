import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { notifySaveError } from '@/lib/saveError';
import { useAuthStore } from '@/store/authStore';
import { cancelReminder, hearingReminderId, scheduleHearingReminder } from '@/lib/notifications';
import type { Hearing, HearingWithCase } from '@/types/database';

const HEARING_SELECT = '*, case:cases(id, title, case_number)';

export function useUpcomingHearings(limit = 5) {
  const ownerId = useAuthStore((s) => s.session?.user.id);

  return useQuery({
    queryKey: ['hearings', 'upcoming', ownerId, limit],
    enabled: !!ownerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hearings')
        .select(HEARING_SELECT)
        .eq('owner_id', ownerId!)
        .eq('is_completed', false)
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(limit);
      if (error) throw error;
      return data as unknown as HearingWithCase[];
    },
  });
}

export function useAllHearings() {
  const ownerId = useAuthStore((s) => s.session?.user.id);

  return useQuery({
    queryKey: ['hearings', 'all', ownerId],
    enabled: !!ownerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hearings')
        .select(HEARING_SELECT)
        .eq('owner_id', ownerId!)
        .order('scheduled_at', { ascending: true });
      if (error) throw error;
      return data as unknown as HearingWithCase[];
    },
  });
}

/** Tek bir duruşmayı id ile getirir (dosyasız kayıtlar dahil, düzenleme için). */
export function useHearing(hearingId: string | undefined) {
  return useQuery({
    queryKey: ['hearings', 'byId', hearingId],
    enabled: !!hearingId,
    queryFn: async () => {
      const { data, error } = await supabase.from('hearings').select(HEARING_SELECT).eq('id', hearingId!).single();
      if (error) throw error;
      return data as unknown as HearingWithCase;
    },
  });
}

export function useHearingsForCase(caseId: string | undefined) {
  return useQuery({
    queryKey: ['hearings', 'byCase', caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hearings')
        .select('*')
        .eq('case_id', caseId!)
        .order('scheduled_at', { ascending: true });
      if (error) throw error;
      return data as Hearing[];
    },
  });
}

export type HearingInput = Pick<
  Hearing,
  'case_id' | 'title' | 'type' | 'location' | 'scheduled_at' | 'reminder_minutes_before' | 'notes'
>;

async function scheduleFromRow(row: Hearing, caseTitle: string) {
  await scheduleHearingReminder({
    id: row.id,
    caseTitle,
    hearingTitle: row.title,
    type: row.type,
    scheduledAt: row.scheduled_at,
    reminderMinutesBefore: row.reminder_minutes_before,
  });
}

export function useCreateHearing() {
  const queryClient = useQueryClient();
  const ownerId = useAuthStore((s) => s.session?.user.id);

  return useMutation({
    onError: notifySaveError,
    mutationFn: async (input: HearingInput & { caseTitle: string }) => {
      const { caseTitle, ...rest } = input;
      const { data, error } = await supabase
        .from('hearings')
        .insert({ ...rest, owner_id: ownerId! })
        .select()
        .single();
      if (error) throw error;
      await scheduleFromRow(data as Hearing, caseTitle);
      return data as Hearing;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hearings'] }),
  });
}

export function useUpdateHearing() {
  const queryClient = useQueryClient();

  return useMutation({
    onError: notifySaveError,
    mutationFn: async ({
      id,
      caseTitle,
      ...rest
    }: Partial<HearingInput> & { id: string; caseTitle: string; is_completed?: boolean }) => {
      const { data, error } = await supabase.from('hearings').update(rest).eq('id', id).select().single();
      if (error) throw error;
      const row = data as Hearing;
      if (row.is_completed) {
        await cancelReminder(hearingReminderId(row.id));
      } else {
        await scheduleFromRow(row, caseTitle);
      }
      return row;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hearings'] }),
  });
}

export function useDeleteHearing() {
  const queryClient = useQueryClient();

  return useMutation({
    onError: notifySaveError,
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('hearings').delete().eq('id', id);
      if (error) throw error;
      await cancelReminder(hearingReminderId(id));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hearings'] }),
  });
}
