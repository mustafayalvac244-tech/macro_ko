import { useQuery } from '@tanstack/react-query';
import { DOCUMENTS_BUCKET, supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';

/** Signed URL for the current user's profile photo (private bucket). */
export function useAvatarUrl(): string | null {
  const avatarPath = useAuthStore((s) => s.profile?.avatar_url ?? null);

  const { data } = useQuery({
    queryKey: ['avatar-url', avatarPath],
    enabled: !!avatarPath,
    staleTime: 45 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .createSignedUrl(avatarPath!, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });

  return avatarPath ? (data ?? null) : null;
}
