import { useEffect } from 'react';
import { format } from 'date-fns';
import { useAllHearings } from '@/hooks/useHearings';
import { useAllDeadlines } from '@/hooks/useDeadlines';
import { syncMorningDigests, digestBucket, type DigestDay, type DigestBucket } from '@/lib/notifications';

const emptyBuckets = (): Record<DigestBucket, number> => ({ durusma: 0, toplanti: 0, kesif: 0, evrak: 0, diger: 0 });

const DIGEST_WINDOW_DAYS = 7;

/**
 * Keeps the next week's 07:30 "good morning" agenda notifications in sync
 * with the user's hearings and tasks. Call once from the dashboard; re-syncs
 * whenever the agenda data changes.
 */
export function useMorningDigest() {
  const hearings = useAllHearings();
  const deadlines = useAllDeadlines();

  const hearingsUpdatedAt = hearings.dataUpdatedAt;
  const deadlinesUpdatedAt = deadlines.dataUpdatedAt;

  useEffect(() => {
    if (!hearings.data || !deadlines.data) return;

    const days = new Map<string, DigestDay>();
    const now = new Date();
    for (let i = 0; i < DIGEST_WINDOW_DAYS; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const key = format(d, 'yyyy-MM-dd');
      days.set(key, { dateKey: key, buckets: emptyBuckets(), tasks: 0 });
    }

    // Track the earliest timed event per day for the "first up" line.
    const firstEvent = new Map<string, { at: number; label: string }>();

    hearings.data.forEach((h) => {
      if (h.is_completed) return;
      const at = new Date(h.scheduled_at);
      const key = format(at, 'yyyy-MM-dd');
      const day = days.get(key);
      if (!day) return;
      day.buckets[digestBucket(h.type)] += 1;
      const existing = firstEvent.get(key);
      if (!existing || at.getTime() < existing.at) {
        firstEvent.set(key, { at: at.getTime(), label: `${format(at, 'HH:mm')} ${h.title}` });
      }
    });

    deadlines.data.forEach((t) => {
      if (t.is_completed) return;
      const at = new Date(t.due_at);
      const key = format(at, 'yyyy-MM-dd');
      const day = days.get(key);
      if (!day) return;
      day.tasks += 1;
    });

    firstEvent.forEach(({ label }, key) => {
      const day = days.get(key);
      if (day) day.firstEventLabel = label;
    });

    syncMorningDigests(Array.from(days.values())).catch(() => {});
    // dataUpdatedAt captures actual refetches; data references alone churn every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hearingsUpdatedAt, deadlinesUpdatedAt]);
}
