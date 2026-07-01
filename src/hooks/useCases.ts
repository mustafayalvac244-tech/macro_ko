import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import type { Case, CaseStatus, CaseWithClient, PriorityLevel } from '@/types/database';

const CASE_SELECT = '*, client:clients(id, full_name, company)';

interface CaseFilters {
  search?: string;
  status?: CaseStatus | 'all';
}

export function useCases(filters: CaseFilters = {}) {
  const ownerId = useAuthStore((s) => s.session?.user.id);

  return useQuery({
    queryKey: ['cases', ownerId, filters.search ?? '', filters.status ?? 'all'],
    enabled: !!ownerId,
    queryFn: async () => {
      let query = supabase
        .from('cases')
        .select(CASE_SELECT)
        .eq('owner_id', ownerId!)
        .order('updated_at', { ascending: false });

      if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);
      if (filters.search) query = query.ilike('title', `%${filters.search}%`);

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as CaseWithClient[];
    },
  });
}

export function useCase(id: string | undefined) {
  return useQuery({
    queryKey: ['cases', 'detail', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('cases').select(CASE_SELECT).eq('id', id!).single();
      if (error) throw error;
      return data as unknown as CaseWithClient;
    },
  });
}

export function useCasesByClient(clientId: string | undefined) {
  return useQuery({
    queryKey: ['cases', 'byClient', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .eq('client_id', clientId!)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as Case[];
    },
  });
}

export type CaseInput = Pick<
  Case,
  | 'title'
  | 'client_id'
  | 'case_number'
  | 'court_name'
  | 'case_type'
  | 'status'
  | 'priority'
  | 'opposing_party'
  | 'description'
  | 'opened_date'
>;

export function useCreateCase() {
  const queryClient = useQueryClient();
  const ownerId = useAuthStore((s) => s.session?.user.id);

  return useMutation({
    mutationFn: async (input: Partial<CaseInput> & { title: string }) => {
      const { data, error } = await supabase
        .from('cases')
        .insert({ ...input, owner_id: ownerId! })
        .select(CASE_SELECT)
        .single();
      if (error) throw error;
      return data as unknown as CaseWithClient;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cases'] }),
  });
}

export function useUpdateCase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: Partial<CaseInput> & { id: string; status?: CaseStatus; priority?: PriorityLevel }) => {
      const { data, error } = await supabase.from('cases').update(input).eq('id', id).select(CASE_SELECT).single();
      if (error) throw error;
      return data as unknown as CaseWithClient;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
    },
  });
}

export function useDeleteCase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cases').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cases'] }),
  });
}
