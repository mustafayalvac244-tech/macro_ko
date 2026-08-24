import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { notifySaveError } from '@/lib/saveError';
import { useAuthStore } from '@/store/authStore';
import type { Job, JobStatus, JobType, JobWithOwner } from '@/types/database';

/** Open listings (plus the caller's own regardless of status). */
export function useJobs() {
  const me = useAuthStore((s) => s.session?.user.id);

  return useQuery({
    queryKey: ['jobs', me],
    enabled: !!me,
    refetchInterval: 30_000,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('*, owner:profiles!jobs_owner_id_fkey(id, full_name, firm_name)')
        .or(`status.eq.open,owner_id.eq.${me}`)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as JobWithOwner[];
    },
  });
}

export interface JobInput {
  title: string;
  description: string | null;
  job_type: JobType;
  city: string;
  courthouse: string | null;
  hearing_date: string | null;
  fee_offer: number | null;
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.session?.user.id);

  return useMutation({
    onError: notifySaveError,
    mutationFn: async (input: JobInput) => {
      const { data, error } = await supabase
        .from('jobs')
        .insert({ ...input, owner_id: me! })
        .select()
        .single();
      if (error) throw error;
      return data as Job;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['jobs'] }),
  });
}

export function useUpdateJobStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    onError: notifySaveError,
    mutationFn: async ({ id, status }: { id: string; status: JobStatus }) => {
      const { error } = await supabase.from('jobs').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['jobs'] }),
  });
}

export function useDeleteJob() {
  const queryClient = useQueryClient();

  return useMutation({
    onError: notifySaveError,
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('jobs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['jobs'] }),
  });
}
