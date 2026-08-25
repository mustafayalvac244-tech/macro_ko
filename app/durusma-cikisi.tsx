import { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAllHearings, useCreateHearing, useUpdateHearing } from '@/hooks/useHearings';
import { useCreateDeadline } from '@/hooks/useDeadlines';
import {
  OUTCOMES,
  OUTCOME_ORDER,
  needsServiceWatch,
  pendingOutcomeHearings,
  planDeadline,
  type OutcomeId,
} from '@/utils/hearingOutcome';
import { useT } from '@/i18n';
import { fonts, spacing, shadow } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { formatDate } from '@/utils/format';

/**
 * DURUŞMA ÇIKIŞI — duruşma bittikten sonraki 60 saniye.
 *
 * Avukat adliyeden çıkarken ne olduğunu bilir; akşama unutur. Uygulamadaki
 * gerçek veri de bunu gösteriyordu (duruşma sayısı süre kaydının kat kat
 * üstünde). Bu ekran sonucu 3 dokunuşta alır ve hukuki sonuçları KENDİSİ
 * oluşturur: sonraki duruşma + kanuni süre.
 *
 * Kanun yoluna başvuru süreleri tebliğden işlediği için (HMK 345/361) "karar
 * açıklandı" seçildiğinde süre uydurulmaz — tebligat tarihi girilirse hesaplanır,
 * girilmezse tebligatı takip hatırlatması kurulur.
 */
export default function DurusmaCikisiScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  const t = useT();

  const hearings = useAllHearings();
  const updateHearing = useUpdateHearing();
  const createHearing = useCreateHearing();
  const createDeadline = useCreateDeadline();

  const pending = useMemo(
    () => pendingOutcomeHearings(hearings.data ?? []),
    [hearings.data]
  );

  const [idx, setIdx] = useState(0);
  const current = pending[idx];

  const [outcome, setOutcome] = useState<OutcomeId | null>(null);
  const [nextDate, setNextDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    d.setHours(9, 30, 0, 0);
    return d;
  });
  const [hasService, setHasService] = useState(false);
  const [serviceDate, setServiceDate] = useState<Date>(new Date());
  const [customDays, setCustomDays] = useState('');
  const [note, setNote] = useState('');
  const [picker, setPicker] = useState<'next' | 'service' | null>(null);
  const [busy, setBusy] = useState(false);

  const def = outcome ? OUTCOMES[outcome] : null;
  const hearingDate = current ? new Date(current.scheduled_at) : new Date();
  const plan = outcome
    ? planDeadline(outcome, hearingDate, hasService ? serviceDate : null, Number(customDays) || undefined)
    : null;
  const watchService = outcome ? needsServiceWatch(outcome, hasService ? serviceDate : null) : false;

  const resetForNext = () => {
    setOutcome(null);
    setHasService(false);
    setCustomDays('');
    setNote('');
    setPicker(null);
  };

  const save = async () => {
    if (!current || !outcome || busy) return;
    setBusy(true);
    const caseTitle = current.case?.title ?? current.title;
    try {
      // 1) Duruşmayı tamamlandı işaretle, sonucu nota yaz.
      const outcomeLabel = t(`hout.o.${outcome}` as const);
      const noteLine = [outcomeLabel, note.trim()].filter(Boolean).join(' — ');
      await updateHearing.mutateAsync({
        id: current.id,
        caseTitle,
        is_completed: true,
        notes: [current.notes, noteLine].filter(Boolean).join('\n'),
      });

      // 2) Sonraki duruşma (gerekiyorsa)
      if (def?.needsNextHearing) {
        await createHearing.mutateAsync({
          case_id: current.case_id,
          title: current.title,
          type: current.type,
          location: current.location,
          scheduled_at: nextDate.toISOString(),
          reminder_minutes_before: current.reminder_minutes_before ?? 60,
          notes: null,
          caseTitle,
        });
      }

      // 3) Süre (hesaplanabiliyorsa)
      if (plan) {
        await createDeadline.mutateAsync({
          case_id: current.case_id,
          title: `${t(`hout.d.${plan.key}` as const)}${plan.basis ? ` (${plan.basis})` : ''}`,
          description: plan.fromService ? t('hout.fromServiceNote') : null,
          due_at: plan.dueAt.toISOString(),
          priority: 'high',
          reminder_minutes_before: 1440,
          caseTitle,
        });
      }

      // 4) Tebligat bekleniyorsa takip işi kur (süre uydurma!).
      if (watchService) {
        const watch = new Date(hearingDate);
        watch.setDate(watch.getDate() + 14);
        await createDeadline.mutateAsync({
          case_id: current.case_id,
          title: t('hout.watchTitle'),
          description: t('hout.watchDesc'),
          due_at: watch.toISOString(),
          priority: 'high',
          reminder_minutes_before: 1440,
          caseTitle,
        });
      }

      // Sıradaki duruşmaya geç
      resetForNext();
      if (idx >= pending.length - 1) {
        Alert.alert(t('hout.title'), t('hout.allDone'), [{ text: t('common.done'), onPress: () => router.back() }]);
      }
    } catch {
      // hata uyarısı notifySaveError ile gösterildi
    } finally {
      setBusy(false);
    }
  };

  if (hearings.isLoading) {
    return (
      <Screen edges={['top', 'left', 'right', 'bottom']}>
        <ScreenHeader title={t('hout.title')} showBack />
      </Screen>
    );
  }

  if (!current) {
    return (
      <Screen edges={['top', 'left', 'right', 'bottom']}>
        <ScreenHeader title={t('hout.title')} showBack />
        <EmptyState icon="checkmark-done-outline" title={t('hout.emptyTitle')} description={t('hout.emptyDesc')} />
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('hout.title')} showBack />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.counter}>{t('hout.counter', { n: idx + 1, total: pending.length })}</Text>

        {/* Hangi duruşma */}
        <View style={styles.hearingCard}>
          <Text style={styles.hearingTitle} numberOfLines={2}>{current.case?.title ?? current.title}</Text>
          <View style={styles.hearingMetaRow}>
            <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
            <Text style={styles.hearingMeta}>{formatDate(current.scheduled_at)}</Text>
            {!!current.location && (
              <>
                <Ionicons name="location-outline" size={13} color={colors.textMuted} />
                <Text style={styles.hearingMeta} numberOfLines={1}>{current.location}</Text>
              </>
            )}
          </View>
        </View>

        {/* 1) Ne oldu? */}
        <Text style={styles.label}>{t('hout.whatHappened')}</Text>
        <View style={styles.chips}>
          {OUTCOME_ORDER.map((id) => {
            const on = outcome === id;
            return (
              <Pressable key={id} onPress={() => setOutcome(id)} style={[styles.chip, on && styles.chipOn]}>
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{t(`hout.o.${id}` as const)}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* 2) Sonraki duruşma */}
        {def?.needsNextHearing && (
          <>
            <Text style={styles.label}>{t('hout.nextHearing')}</Text>
            <Pressable style={styles.dateBtn} onPress={() => setPicker(picker === 'next' ? null : 'next')}>
              <Ionicons name="calendar" size={16} color={colors.primary} />
              <Text style={styles.dateBtnText}>{formatDate(nextDate.toISOString())}</Text>
            </Pressable>
          </>
        )}

        {/* 3) Tebliğden işleyen süre → tebligat tarihi */}
        {def?.runsFromService && (
          <View style={styles.serviceBox}>
            <View style={styles.serviceHead}>
              <Ionicons name="mail-outline" size={16} color={colors.primary} />
              <Text style={styles.serviceTitle}>{t('hout.serviceQ')}</Text>
              <Switch value={hasService} onValueChange={setHasService} />
            </View>
            <Text style={styles.serviceHint}>{t('hout.serviceHint')}</Text>
            {hasService && (
              <Pressable style={styles.dateBtn} onPress={() => setPicker(picker === 'service' ? null : 'service')}>
                <Ionicons name="calendar" size={16} color={colors.primary} />
                <Text style={styles.dateBtnText}>{formatDate(serviceDate.toISOString())}</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* 4) Süre gün sayısı (hâkimin verdiği süre farklıysa) */}
        {!!def?.deadlineDays && (
          <>
            <Text style={styles.label}>{t('hout.daysLabel', { d: def.deadlineDays })}</Text>
            <TextInput
              style={styles.daysInput}
              value={customDays}
              onChangeText={setCustomDays}
              placeholder={String(def.deadlineDays)}
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
            />
          </>
        )}

        {/* Önizleme: ne oluşturulacak */}
        {!!outcome && (
          <View style={styles.preview}>
            <Text style={styles.previewTitle}>{t('hout.willCreate')}</Text>
            {def?.needsNextHearing && (
              <Row icon="calendar" color={colors.primary} text={`${t('hout.pvHearing')}: ${formatDate(nextDate.toISOString())}`} styles={styles} />
            )}
            {plan && (
              <Row
                icon="alarm"
                color={colors.danger}
                text={`${t(`hout.d.${plan.key}` as const)}: ${formatDate(plan.dueAt.toISOString())}${plan.basis ? ` · ${plan.basis}` : ''}`}
                styles={styles}
              />
            )}
            {watchService && (
              <Row icon="eye" color={colors.warning ?? colors.primary} text={t('hout.pvWatch')} styles={styles} />
            )}
            {!def?.needsNextHearing && !plan && !watchService && (
              <Row icon="checkmark-circle" color={colors.success} text={t('hout.pvOnlyClose')} styles={styles} />
            )}
          </View>
        )}

        {/* Not */}
        <Text style={styles.label}>{t('hout.noteLabel')}</Text>
        <TextInput
          style={styles.noteInput}
          value={note}
          onChangeText={setNote}
          placeholder={t('hout.notePlaceholder')}
          placeholderTextColor={colors.textMuted}
          multiline
          textAlignVertical="top"
        />

        {picker && (
          <View style={styles.pickerPanel}>
            <DateTimePicker
              locale="tr-TR"
              value={picker === 'next' ? nextDate : serviceDate}
              mode="date"
              display="spinner"
              onChange={(_e, d) => {
                if (Platform.OS === 'android') setPicker(null);
                if (!d) return;
                if (picker === 'next') {
                  const n = new Date(nextDate);
                  n.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
                  setNextDate(n);
                } else {
                  setServiceDate(d);
                }
              }}
            />
            {Platform.OS === 'ios' && <Button label={t('common.done')} size="sm" onPress={() => setPicker(null)} fullWidth />}
          </View>
        )}

        <Button
          label={busy ? t('hout.saving') : t('hout.saveCta')}
          onPress={save}
          disabled={!outcome || busy}
          fullWidth
          style={styles.cta}
        />

        <Pressable onPress={() => { resetForNext(); setIdx((v) => Math.min(v + 1, pending.length - 1)); }} style={styles.skip}>
          <Text style={styles.skipText}>{t('hout.skip')}</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function Row({ icon, color, text, styles }: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  text: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.pvRow}>
      <Ionicons name={icon} size={15} color={color} />
      <Text style={styles.pvText}>{text}</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  counter: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  hearingCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.md,
    ...shadow.card,
    marginBottom: spacing.lg,
  },
  hearingTitle: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: -0.3,
    color: colors.textPrimary,
  },
  hearingMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, flexWrap: 'wrap' },
  hearingMeta: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textMuted, flexShrink: 1 },
  label: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  chipOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipText: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary },
  chipTextOn: { fontFamily: fonts.extrabold, fontWeight: '800', color: colors.primary },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  dateBtnText: { fontFamily: fonts.bold, fontWeight: '700', fontSize: 14, color: colors.textPrimary },
  serviceBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    padding: spacing.md,
    marginTop: spacing.md,
    gap: 8,
  },
  serviceHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  serviceTitle: { fontFamily: fonts.bold, fontWeight: '700', fontSize: 13.5, color: colors.textPrimary, flex: 1 },
  serviceHint: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.textSecondary },
  daysInput: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  preview: {
    backgroundColor: colors.primarySoft,
    borderRadius: 16,
    padding: spacing.md,
    marginTop: spacing.lg,
    gap: 8,
  },
  previewTitle: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    fontSize: 10.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.primary,
  },
  pvRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  pvText: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: colors.textPrimary, flex: 1 },
  noteInput: {
    minHeight: 70,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.md,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textPrimary,
  },
  pickerPanel: { alignItems: 'center', marginTop: spacing.md },
  cta: { marginTop: spacing.lg },
  skip: { alignSelf: 'center', paddingVertical: spacing.md },
  skipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
});
