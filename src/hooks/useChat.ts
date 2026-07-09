import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import type { DmMessage, PublicProfile } from '@/types/database';

/**
 * Live delivery: subscribe to new DMs addressed to me and refresh the thread
 * and conversation list instantly (WhatsApp-style). Polling remains as a
 * fallback for projects where realtime isn't enabled on the table.
 */
export function useDmRealtime() {
  const me = useAuthStore((s) => s.session?.user.id);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!me) return;
    const channel = supabase
      .channel(`dm-${me}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'dm_messages', filter: `recipient_id=eq.${me}` },
        () => queryClient.invalidateQueries({ queryKey: ['dm'] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel).catch(() => {});
    };
  }, [me, queryClient]);
}

/** True when the 0007_network.sql migration hasn't been run yet. */
export function isMissingNetworkTables(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  if (!e) return false;
  if (e.code === '42P01' || e.code === 'PGRST205') return true;
  const msg = (e.message ?? '').toLowerCase();
  return msg.includes('dm_messages') || msg.includes('jobs');
}

export interface Conversation {
  peer: PublicProfile;
  lastMessage: DmMessage;
  unread: number;
}

/** All conversations of the signed-in user, grouped by peer. */
export function useConversations() {
  const me = useAuthStore((s) => s.session?.user.id);

  return useQuery({
    queryKey: ['dm', 'conversations', me],
    enabled: !!me,
    refetchInterval: 15_000,
    retry: (n, err) => !isMissingNetworkTables(err) && n < 1,
    queryFn: async (): Promise<Conversation[]> => {
      const { data, error } = await supabase
        .from('dm_messages')
        .select('*')
        .or(`sender_id.eq.${me},recipient_id.eq.${me}`)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      const messages = data as DmMessage[];

      const byPeer = new Map<string, { lastMessage: DmMessage; unread: number }>();
      messages.forEach((m) => {
        const peerId = m.sender_id === me ? m.recipient_id : m.sender_id;
        const entry = byPeer.get(peerId);
        const unreadInc = m.recipient_id === me && !m.read_at ? 1 : 0;
        if (!entry) {
          byPeer.set(peerId, { lastMessage: m, unread: unreadInc });
        } else {
          entry.unread += unreadInc;
        }
      });

      if (byPeer.size === 0) return [];
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, full_name, firm_name, bar_number, avatar_url, is_premium')
        .in('id', Array.from(byPeer.keys()));
      if (pErr) throw pErr;
      const profileMap = new Map((profiles as PublicProfile[]).map((p) => [p.id, p]));

      return Array.from(byPeer.entries())
        .map(([peerId, { lastMessage, unread }]) => ({
          peer: profileMap.get(peerId) ?? { id: peerId, full_name: '?', firm_name: null, bar_number: null, avatar_url: null },
          lastMessage,
          unread,
        }))
        .sort((a, b) => b.lastMessage.created_at.localeCompare(a.lastMessage.created_at));
    },
  });
}

/** Message thread with one peer, newest last. Polls while open. */
export function useThread(peerId: string | undefined) {
  const me = useAuthStore((s) => s.session?.user.id);

  return useQuery({
    queryKey: ['dm', 'thread', me, peerId],
    enabled: !!me && !!peerId,
    refetchInterval: 4_000, // fallback; realtime channel makes it instant
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dm_messages')
        .select('*')
        .or(
          `and(sender_id.eq.${me},recipient_id.eq.${peerId}),and(sender_id.eq.${peerId},recipient_id.eq.${me})`
        )
        .order('created_at', { ascending: true })
        .limit(300);
      if (error) throw error;
      return data as DmMessage[];
    },
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.session?.user.id);

  return useMutation({
    mutationFn: async ({ recipientId, body }: { recipientId: string; body: string }) => {
      const { data, error } = await supabase
        .from('dm_messages')
        .insert({ sender_id: me!, recipient_id: recipientId, body })
        .select()
        .single();
      if (error) throw error;
      return data as DmMessage;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dm'] }),
  });
}

export function useMarkThreadRead() {
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.session?.user.id);

  return useMutation({
    mutationFn: async (peerId: string) => {
      const { error } = await supabase
        .from('dm_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('recipient_id', me!)
        .eq('sender_id', peerId)
        .is('read_at', null);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dm', 'conversations'] }),
  });
}

/** Search the lawyer directory by name/firm. Excludes the signed-in user. */
export function useLawyerDirectory(search: string) {
  const me = useAuthStore((s) => s.session?.user.id);
  const q = search.trim();

  return useQuery({
    queryKey: ['directory', q],
    enabled: !!me && q.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, firm_name, bar_number, avatar_url, is_premium')
        .neq('id', me!)
        .or(`full_name.ilike.%${q}%,firm_name.ilike.%${q}%`)
        .limit(20);
      if (error) throw error;
      return data as PublicProfile[];
    },
  });
}

/** One lawyer's public profile (chat screen header). */
export function usePeerProfile(peerId: string | undefined) {
  return useQuery({
    queryKey: ['peer', peerId],
    enabled: !!peerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, firm_name, bar_number, avatar_url, is_premium')
        .eq('id', peerId!)
        .single();
      if (error) throw error;
      return data as PublicProfile;
    },
  });
}
