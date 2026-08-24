import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { notifySaveError } from '@/lib/saveError';
import { useAuthStore } from '@/store/authStore';
import { cancelReminder, deadlineReminderId, scheduleDeadlineReminder } from '@/lib/notifications';
import type { Deadline, DeadlineWithCase } from '@/types/database';

const DEADLINE_SELECT = '*, case:cases(id, title, case_number)';

export function useUpcomingDeadlines(limit = 5) {
  const ownerId = useAuthStore((s) => s.session?.user.id);

  return useQuery({
    queryKey: ['deadlines', 'upcoming', ownerId, limit],
    enabled: !!ownerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deadlines')
        .select(DEADLINE_SELECT)
        .eq('owner_id', ownerId!)
        .eq('is_completed', false)
        .order('due_at', { ascending: true })
        .limit(limit);
      if (error) throw error;
      return data as unknown as DeadlineWithCase[];
    },
  });
}

export function useAllDeadlines() {
  const ownerId = useAuthStore((s) => s.session?.user.id);

  return useQuery({
    queryKey: ['deadlines', 'all', ownerId],
    enabled: !!ownerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deadlines')
        .select(DEADLINE_SELECT)
        .eq('owner_id', ownerId!)
        .order('due_at', { ascending: true });
      if (error) throw error;
      return data as unknown as DeadlineWithCase[];
    },
  });
}

/** Tek bir görevi id ile getirir (dosyasız kayıtlar dahil, düzenleme için). */
export function useDeadline(deadlineId: string | undefined) {
  return useQuery({
    queryKey: ['deadlines', 'byId', deadlineId],
    enabled: !!deadlineId,
    queryFn: async () => {
      const { data, error } = await supabase.from('deadlines').select(DEADLINE_SELECT).eq('id', deadlineId!).single();
      if (error) throw error;
      return data as unknown as DeadlineWithCase;
    },
  });
}

export function useDeadlinesForCase(caseId: string | undefined) {
  return useQuery({
    queryKey: ['deadlines', 'byCase', caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deadlines')
        .select('*')
        .eq('case_id', caseId!)
        .order('due_at', { ascending: true });
      if (error) throw error;
      return data as Deadline[];
    },
  });
}

export type DeadlineInput = Pick<
  Deadline,
  'case_id' | 'title' | 'description' | 'due_at' | 'priority' | 'reminder_minutes_before'
>;

async function scheduleFromRow(row: Deadline, caseTitle: string) {
  await scheduleDeadlineReminder({
    id: row.id,
    caseTitle,
    deadlineTitle: row.title,
    dueAt: row.due_at,
    reminderMinutesBefore: row.reminder_minutes_before,
  });
}

export function useCreateDeadline() {
  const queryClient = useQueryClient();
  const ownerId = useAuthStore((s) => s.session?.user.id);

  return useMutation({
    onError: notifySaveError,
    mutationFn: async (input: DeadlineInput & { caseTitle: string }) => {
      const { caseTitle, ...rest } = input;
      const { data, error } = await supabase
        .from('deadlines')
        .insert({ ...rest, owner_id: ownerId! })
        .select()
        .single();
      if (error) throw error;
      await scheduleFromRow(data as Deadline, caseTitle);
      return data as Deadline;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deadlines'] }),
  });
}

export function useUpdateDeadline() {
  const queryClient = useQueryClient();

  return useMutation({
    onError: notifySaveError,
    mutationFn: async ({
      id,
      caseTitle,
      ...rest
    }: Partial<DeadlineInput> & { id: string; caseTitle: string; is_completed?: boolean }) => {
      const { data, error } = await supabase.from('deadlines').update(rest).eq('id', id).select().single();
      if (error) throw error;
      const row = data as Deadline;
      if (row.is_completed) {
        await cancelReminder(deadlineReminderId(row.id));
      } else {
        await scheduleFromRow(row, caseTitle);
      }
      return row;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deadlines'] }),
  });
}

export function useDeleteDeadline() {
  const queryClient = useQueryClient();

  return useMutation({
    onError: notifySaveError,
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('deadlines').delete().eq('id', id);
      if (error) throw error;
      await cancelReminder(deadlineReminderId(id));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deadlines'] }),
  });
}
