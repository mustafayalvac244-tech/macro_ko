import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import type { Office, OfficeMessage, PublicProfile } from '@/types/database';

export interface OfficeMemberWithProfile {
  user_id: string;
  role: 'admin' | 'member';
  profile: PublicProfile | null;
}

/** The office the signed-in user belongs to (one office per user for now). */
export function useMyOffice() {
  const me = useAuthStore((s) => s.session?.user.id);

  return useQuery({
    queryKey: ['office', 'mine', me],
    enabled: !!me,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('office_members')
        .select('role, office:offices(id, name, owner_id, created_at)')
        .eq('user_id', me!)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data?.office) return null;
      return { office: data.office as unknown as Office, role: data.role as 'admin' | 'member' };
    },
  });
}

export function useCreateOffice() {
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.session?.user.id);

  return useMutation({
    mutationFn: async (name: string) => {
      const { data: office, error } = await supabase
        .from('offices')
        .insert({ name: name.trim(), owner_id: me! })
        .select()
        .single();
      if (error) throw error;
      const { error: mErr } = await supabase
        .from('office_members')
        .insert({ office_id: (office as Office).id, user_id: me!, role: 'admin' });
      if (mErr) throw mErr;
      return office as Office;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['office'] }),
  });
}

export function useOfficeMembers(officeId: string | undefined) {
  return useQuery({
    queryKey: ['office', 'members', officeId],
    enabled: !!officeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('office_members')
        .select('user_id, role, profile:profiles(id, full_name, firm_name, bar_number, avatar_url)')
        .eq('office_id', officeId!)
        .order('joined_at');
      if (error) throw error;
      return data as unknown as OfficeMemberWithProfile[];
    },
  });
}

export function useAddOfficeMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ officeId, userId }: { officeId: string; userId: string }) => {
      const { error } = await supabase
        .from('office_members')
        .insert({ office_id: officeId, user_id: userId, role: 'member' });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['office'] }),
  });
}

export function useRemoveOfficeMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ officeId, userId }: { officeId: string; userId: string }) => {
      const { error } = await supabase
        .from('office_members')
        .delete()
        .eq('office_id', officeId)
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['office'] }),
  });
}

/** Office room messages. Live via realtime; short polling stays as fallback. */
export function useOfficeMessages(officeId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!officeId) return;
    const channel = supabase
      .channel(`office-${officeId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'office_messages', filter: `office_id=eq.${officeId}` },
        () => queryClient.invalidateQueries({ queryKey: ['office', 'messages', officeId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel).catch(() => {});
    };
  }, [officeId, queryClient]);

  return useQuery({
    queryKey: ['office', 'messages', officeId],
    enabled: !!officeId,
    refetchInterval: 6_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('office_messages')
        .select('*, sender:profiles(id, full_name)')
        .eq('office_id', officeId!)
        .order('created_at', { ascending: true })
        .limit(300);
      if (error) throw error;
      return data as unknown as Array<OfficeMessage & { sender: { id: string; full_name: string } | null }>;
    },
  });
}

export function useSendOfficeMessage() {
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.session?.user.id);

  return useMutation({
    mutationFn: async ({ officeId, body }: { officeId: string; body: string }) => {
      const { error } = await supabase
        .from('office_messages')
        .insert({ office_id: officeId, sender_id: me!, body });
      if (error) throw error;
    },
    onSuccess: (_d, v) => queryClient.invalidateQueries({ queryKey: ['office', 'messages', v.officeId] }),
  });
}
