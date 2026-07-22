import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Input } from '@/components/ui/Input';
import { SuggestInput } from '@/components/ui/SuggestInput';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { CasePicker } from '@/components/CasePicker';
import { useCase } from '@/hooks/useCases';
import { useAllHearings, useCreateHearing, useHearing, useHearingsForCase, useUpdateHearing } from '@/hooks/useHearings';
import { hearingTitleSuggestions, meetingTitleSuggestions } from '@/constants/suggestions';
import { useLangStore, useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { formatDate, formatTime } from '@/utils/format';
import { addToDeviceCalendar } from '@/utils/deviceCalendar';
import type { HearingType } from '@/types/database';

// Keşif (deposition) öne alındı — Burak geri bildirimi: keşif tarihini
// girecek yeri bulamıyordu. Artık Duruşma'nın hemen yanında.
const TYPE_VALUES: HearingType[] = ['hearing', 'deposition', 'trial', 'mediation', 'filing', 'meeting', 'other'];

const REMINDER_VALUES = [
  { key: 'reminder.30m', value: '30' },
  { key: 'reminder.1h', value: '60' },
  { key: 'reminder.1d', value: '1440' },
  { key: 'reminder.3d', value: '4320' },
  { key: 'reminder.1w', value: '10080' },
] as const;

export default function HearingFormScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);

  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const { caseId: caseIdParam, id, type: typeParam } = useLocalSearchParams<{ caseId?: string; id?: string; type?: string }>();
  const isEdit = !!id;
  // Takvimden dosya parametresi olmadan açılırsa dosya burada seçilir.
  const [pickedCaseId, setPickedCaseId] = useState<string | null>(null);
  // Düzenlemede kayıt doğrudan id ile yüklenir (dosyasız toplantılar dahil).
  const { data: editing } = useHearing(id);
  const caseId = caseIdParam || pickedCaseId || editing?.case_id || undefined;
  const { data: caseItem } = useCase(caseId);
  const { data: hearings } = useHearingsForCase(caseId);
  const existing = editing ?? hearings?.find((h) => h.id === id);

  const createHearing = useCreateHearing();
  const updateHearing = useUpdateHearing();

  const [title, setTitle] = useState('');
  const [type, setType] = useState<HearingType>(
    TYPE_VALUES.includes(typeParam as HearingType) ? (typeParam as HearingType) : 'hearing'
  );
  const [location, setLocation] = useState('');
  // Toplantı/arabuluculuk lokasyon seçenekleri
  const [meetingPlace, setMeetingPlace] = useState<'ofis' | 'online' | 'muvekkil_adresi' | 'diger'>('ofis');
  const [mediationWith, setMediationWith] = useState<'taraf' | 'arabulucu'>('taraf');
  const [mediationPlace, setMediationPlace] = useState<'ofis' | 'online'>('ofis');
  const [notes, setNotes] = useState('');
  const [scheduledAt, setScheduledAt] = useState(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const [reminder, setReminder] = useState('1440');
  const [showPicker, setShowPicker] = useState<'date' | 'time' | null>(null);

  useEffect(() => {
    if (existing) {
      setTitle(existing.title);
      setType(existing.type);
      setLocation(existing.location ?? '');
      setNotes(existing.notes ?? '');
      setScheduledAt(new Date(existing.scheduled_at));
      setReminder(String(existing.reminder_minutes_before));
    }
  }, [existing]);

  const isSubmitting = createHearing.isPending || updateHearing.isPending;
  const allHearings = useAllHearings();

  // Clash warning: another (not completed) hearing within ±90 minutes.
  const clash = useMemo(() => {
    const ts = scheduledAt.getTime();
    const windowMs = 90 * 60 * 1000;
    return (
      (allHearings.data ?? []).find((h) => {
        if (h.id === id || h.is_completed) return false;
        return Math.abs(new Date(h.scheduled_at).getTime() - ts) < windowMs;
      }) ?? null
    );
  }, [allHearings.data, scheduledAt, id]);

  // "Toplantı" kısayolundan açıldığında form toplantı odaklıdır: tür listesi
  // toplantı/arabuluculukla sınırlanır, başlık/öneri/buton metinleri değişir.
  const meetingMode = typeParam === 'meeting' || typeParam === 'mediation';
  const isMeetingType = type === 'meeting' || type === 'mediation';
  const typeValues: HearingType[] = meetingMode && !isEdit ? ['meeting', 'mediation'] : TYPE_VALUES.slice();
  const typeOptions = typeValues.map((value) => ({ value, label: t(`hearingType.${value}` as const) }));
  const reminderOptions = REMINDER_VALUES.map(({ key, value }) => ({ value, label: t(key) }));

  const handleSubmit = async () => {
    const payload = {
      case_id: caseItem?.id ?? null,
      title: title.trim(),
      type,
      location:
        type === 'meeting'
          ? t(`meetPlace.${meetingPlace}` as const) + (meetingPlace === 'muvekkil_adresi' || meetingPlace === 'diger' ? (location.trim() ? ` — ${location.trim()}` : '') : '')
          : type === 'mediation'
            ? `${t(`medWith.${mediationWith}` as const)} · ${t(`meetPlace.${mediationPlace}` as const)}`
            : location.trim() || null,
      scheduled_at: scheduledAt.toISOString(),
      reminder_minutes_before: Number(reminder),
      notes: notes.trim() || null,
      caseTitle: caseItem?.title ?? title.trim(),
    };

    if (isEdit && id) {
      await updateHearing.mutateAsync({ id, ...payload });
      router.back();
      return;
    }
    await createHearing.mutateAsync(payload);

    // Yeni kayıt telefonun takvimine de yazılsın mı?
    Alert.alert(t('devCal.askTitle'), t('devCal.askMsg'), [
      { text: t('common.no'), style: 'cancel', onPress: () => router.back() },
      {
        text: t('common.yes'),
        onPress: async () => {
          const res = await addToDeviceCalendar({
            title: caseItem ? `${payload.title} — ${caseItem.title}` : payload.title,
            startISO: payload.scheduled_at,
            location: payload.location,
            notes: payload.notes,
          });
          if (res === 'added') Alert.alert(t('devCal.addedTitle'), t('devCal.addedMsg'));
          else if (res === 'unavailable') Alert.alert(t('devCal.askTitle'), t('devCal.unavailable'));
          else if (res === 'error') Alert.alert(t('devCal.askTitle'), t('devCal.error'));
          // 'canceled' → kullanıcı vazgeçti, mesaj gösterme
          router.back();
        },
      },
    ]);
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader
        title={isEdit ? t('hearingForm.editTitle') : isMeetingType ? t('hearingForm.newMeetingTitle') : t('hearingForm.newTitle')}
        subtitle={caseItem?.title}
        showBack
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {!caseIdParam && <CasePicker value={pickedCaseId} onChange={setPickedCaseId} />}
          <SuggestInput
            label={t('hearingForm.title')}
            placeholder={isMeetingType ? t('hearingForm.titleMeetingPh') : t('hearingForm.titlePlaceholder')}
            value={title}
            onChangeText={setTitle}
            suggestions={isMeetingType ? meetingTitleSuggestions[lang] : hearingTitleSuggestions[lang]}
          />

          <Text style={styles.label}>{t('hearingForm.type')}</Text>
          {/* Çip ızgarası: 7 tür tek satır SegmentedControl'de sıkışıp okunmuyordu
              (Keşif dahil). Kaydırmalı çiplerde hepsi net görünür. */}
          <View style={styles.typeChips}>
            {typeOptions.map((opt) => {
              const active = type === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setType(opt.value)}
                  style={[styles.typeChip, active && styles.typeChipActive]}
                >
                  <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.spacer} />
          <Text style={styles.label}>{t('hearingForm.datetime')}</Text>
          {/* Tarih ve saat ayrı butonlarda: zincirleme picker bazı Android
              cihazlarda saati açmıyordu; her biri kendi seçicisini açar. */}
          <View style={styles.dtRow}>
            <Pressable style={[styles.dateButton, styles.dtHalf]} onPress={() => setShowPicker('date')}>
              <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
              <Text style={styles.dateButtonText}>{formatDate(scheduledAt.toISOString())}</Text>
            </Pressable>
            <Pressable style={[styles.dateButton, styles.dtHalf]} onPress={() => setShowPicker('time')}>
              <Ionicons name="time-outline" size={18} color={colors.textMuted} />
              <Text style={styles.dateButtonText}>{formatTime(scheduledAt.toISOString())}</Text>
            </Pressable>
          </View>
          {showPicker && (
            // Seçici, köşede kalmasın diye kendi ortalı paneline alındı; saatin/
            // tarihin hemen altında düzgün görünür (alıcı geri bildirimi).
            <View style={styles.pickerPanel}>
              <DateTimePicker locale="tr-TR"
                value={scheduledAt}
                mode={showPicker}
                is24Hour
                display="spinner"
                onChange={(_event, date) => {
                  if (Platform.OS === 'android') setShowPicker(null);
                  if (!date) return;
                  const next = new Date(scheduledAt);
                  if (showPicker === 'date') {
                    next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                  } else {
                    next.setHours(date.getHours(), date.getMinutes());
                  }
                  setScheduledAt(next);
                }}
              />
              {Platform.OS === 'ios' && (
                <Button label={t('common.done')} size="sm" onPress={() => setShowPicker(null)} fullWidth style={styles.pickerDone} />
              )}
            </View>
          )}

          {clash && (
            <View style={styles.warnBox}>
              <Ionicons name="warning" size={18} color={colors.warning} />
              <Text style={styles.warnText}>
                {t('clash.warn', {
                  title: clash.title,
                  time: formatTime(clash.scheduled_at),
                  case: clash.case?.title ?? '',
                })}
              </Text>
            </View>
          )}

          <View style={styles.spacer} />
          {type === 'meeting' ? (
            <>
              <Text style={styles.label}>{t('meet.place')}</Text>
              <SegmentedControl
                scrollable={false}
                options={[
                  { value: 'ofis', label: t('meetPlace.ofis') },
                  { value: 'online', label: t('meetPlace.online') },
                  { value: 'muvekkil_adresi', label: t('meetPlace.muvekkil_adresi') },
                  { value: 'diger', label: t('meetPlace.diger') },
                ]}
                value={meetingPlace}
                onChange={(v) => setMeetingPlace(v as typeof meetingPlace)}
              />
              {(meetingPlace === 'muvekkil_adresi' || meetingPlace === 'diger') && (
                <>
                  <View style={styles.spacer} />
                  <Input label={t('meet.addr')} placeholder={t('meet.addrPh')} value={location} onChangeText={setLocation} />
                </>
              )}
            </>
          ) : type === 'mediation' ? (
            <>
              <Text style={styles.label}>{t('med.with')}</Text>
              <SegmentedControl
                scrollable={false}
                options={[
                  { value: 'taraf', label: t('medWith.taraf') },
                  { value: 'arabulucu', label: t('medWith.arabulucu') },
                ]}
                value={mediationWith}
                onChange={(v) => setMediationWith(v as typeof mediationWith)}
              />
              <View style={styles.spacer} />
              <Text style={styles.label}>{t('meet.place')}</Text>
              <SegmentedControl
                scrollable={false}
                options={[
                  { value: 'ofis', label: t('meetPlace.ofis') },
                  { value: 'online', label: t('meetPlace.online') },
                ]}
                value={mediationPlace}
                onChange={(v) => setMediationPlace(v as typeof mediationPlace)}
              />
            </>
          ) : (
            <Input label={t('hearingForm.location')} placeholder={t('hearingForm.locationPlaceholder')} value={location} onChangeText={setLocation} />
          )}

          <Text style={styles.label}>{t('hearingForm.remind')}</Text>
          <SegmentedControl options={reminderOptions} value={reminder} onChange={setReminder} />

          <View style={styles.spacer} />
          <Input
            label={t('hearingForm.notes')}
            placeholder={t('hearingForm.notesPlaceholder')}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            style={styles.textArea}
          />

          <Button
            label={isEdit ? t('common.save') : isMeetingType ? t('hearingForm.scheduleMeeting') : t('hearingForm.schedule')}
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={!title.trim()}
            fullWidth
            size="lg"
            style={styles.submit}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  spacer: {
    height: spacing.md,
  },
  typeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  typeChip: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  typeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeChipText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  typeChipTextActive: {
    color: colors.textInverse,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
  },
  dateButtonText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  dtRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dtHalf: {
    flex: 1,
  },
  pickerPanel: {
    marginTop: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 14,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  pickerDone: {
    marginTop: spacing.xs,
  },
  warnBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: 12,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  warnText: {
    ...typography.caption,
    color: colors.textPrimary,
    flex: 1,
    lineHeight: 18,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: 13,
  },
  submit: {
    marginTop: spacing.lg,
  },
});
