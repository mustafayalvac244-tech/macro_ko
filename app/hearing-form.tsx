import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Input } from '@/components/ui/Input';
import { SuggestInput } from '@/components/ui/SuggestInput';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useCase } from '@/hooks/useCases';
import { useCreateHearing, useHearingsForCase, useUpdateHearing } from '@/hooks/useHearings';
import { hearingTitleSuggestions } from '@/constants/suggestions';
import { useLangStore, useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { formatDateTime } from '@/utils/format';
import type { HearingType } from '@/types/database';

const TYPE_VALUES: HearingType[] = ['hearing', 'trial', 'mediation', 'deposition', 'filing', 'meeting', 'other'];

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
  const { caseId, id } = useLocalSearchParams<{ caseId: string; id?: string }>();
  const isEdit = !!id;
  const { data: caseItem } = useCase(caseId);
  const { data: hearings } = useHearingsForCase(caseId);
  const existing = hearings?.find((h) => h.id === id);

  const createHearing = useCreateHearing();
  const updateHearing = useUpdateHearing();

  const [title, setTitle] = useState('');
  const [type, setType] = useState<HearingType>('hearing');
  const [location, setLocation] = useState('');
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

  const typeOptions = TYPE_VALUES.map((value) => ({ value, label: t(`hearingType.${value}` as const) }));
  const reminderOptions = REMINDER_VALUES.map(({ key, value }) => ({ value, label: t(key) }));

  const handleSubmit = async () => {
    if (!caseItem) return;
    const payload = {
      case_id: caseItem.id,
      title: title.trim(),
      type,
      location: location.trim() || null,
      scheduled_at: scheduledAt.toISOString(),
      reminder_minutes_before: Number(reminder),
      notes: notes.trim() || null,
      caseTitle: caseItem.title,
    };

    if (isEdit && id) {
      await updateHearing.mutateAsync({ id, ...payload });
    } else {
      await createHearing.mutateAsync(payload);
    }
    router.back();
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={isEdit ? t('hearingForm.editTitle') : t('hearingForm.newTitle')} subtitle={caseItem?.title} showBack />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <SuggestInput
            label={t('hearingForm.title')}
            placeholder={t('hearingForm.titlePlaceholder')}
            value={title}
            onChangeText={setTitle}
            suggestions={hearingTitleSuggestions[lang]}
          />

          <Text style={styles.label}>{t('hearingForm.type')}</Text>
          <SegmentedControl options={typeOptions} value={type} onChange={setType} />

          <View style={styles.spacer} />
          <Text style={styles.label}>{t('hearingForm.datetime')}</Text>
          <Pressable style={styles.dateButton} onPress={() => setShowPicker('date')}>
            <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
            <Text style={styles.dateButtonText}>{formatDateTime(scheduledAt.toISOString())}</Text>
          </Pressable>
          {showPicker && (
            <DateTimePicker
              value={scheduledAt}
              mode={showPicker}
              onChange={(_event, date) => {
                if (Platform.OS === 'android') {
                  setShowPicker(null);
                  if (date) {
                    if (showPicker === 'date') {
                      const next = new Date(scheduledAt);
                      next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                      setScheduledAt(next);
                      setTimeout(() => setShowPicker('time'), 250);
                    } else {
                      const next = new Date(scheduledAt);
                      next.setHours(date.getHours(), date.getMinutes());
                      setScheduledAt(next);
                    }
                  }
                } else if (date) {
                  setScheduledAt(date);
                }
              }}
            />
          )}
          {Platform.OS === 'ios' && showPicker && (
            <Button label={t('common.done')} size="sm" variant="secondary" onPress={() => setShowPicker(null)} style={styles.pickerDone} />
          )}

          <View style={styles.spacer} />
          <Input label={t('hearingForm.location')} placeholder={t('hearingForm.locationPlaceholder')} value={location} onChangeText={setLocation} />

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
            label={isEdit ? t('common.save') : t('hearingForm.schedule')}
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
  pickerDone: {
    marginTop: spacing.xs,
    alignSelf: 'flex-end',
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
