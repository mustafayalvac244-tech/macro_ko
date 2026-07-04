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
import { useCreateDeadline, useDeadlinesForCase, useUpdateDeadline } from '@/hooks/useDeadlines';
import { deadlineTitleSuggestions } from '@/constants/suggestions';
import { useLangStore, useT } from '@/i18n';
import { colors, spacing, typography } from '@/theme/theme';
import { formatDateTime } from '@/utils/format';
import type { PriorityLevel } from '@/types/database';

const PRIORITY_VALUES: PriorityLevel[] = ['low', 'medium', 'high', 'critical'];

const REMINDER_VALUES = [
  { key: 'reminder.1h', value: '60' },
  { key: 'reminder.1d', value: '1440' },
  { key: 'reminder.3d', value: '4320' },
  { key: 'reminder.1w', value: '10080' },
  { key: 'reminder.2w', value: '20160' },
] as const;

export default function DeadlineFormScreen() {
  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const { caseId, id } = useLocalSearchParams<{ caseId: string; id?: string }>();
  const isEdit = !!id;
  const { data: caseItem } = useCase(caseId);
  const { data: deadlines } = useDeadlinesForCase(caseId);
  const existing = deadlines?.find((d) => d.id === id);

  const createDeadline = useCreateDeadline();
  const updateDeadline = useUpdateDeadline();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueAt, setDueAt] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  const [priority, setPriority] = useState<PriorityLevel>('medium');
  const [reminder, setReminder] = useState('1440');
  const [showPicker, setShowPicker] = useState<'date' | 'time' | null>(null);

  useEffect(() => {
    if (existing) {
      setTitle(existing.title);
      setDescription(existing.description ?? '');
      setDueAt(new Date(existing.due_at));
      setPriority(existing.priority);
      setReminder(String(existing.reminder_minutes_before));
    }
  }, [existing]);

  const isSubmitting = createDeadline.isPending || updateDeadline.isPending;

  const priorityOptions = PRIORITY_VALUES.map((value) => ({ value, label: t(`priority.${value}` as const) }));
  const reminderOptions = REMINDER_VALUES.map(({ key, value }) => ({ value, label: t(key) }));

  const handleSubmit = async () => {
    if (!caseItem) return;
    const payload = {
      case_id: caseItem.id,
      title: title.trim(),
      description: description.trim() || null,
      due_at: dueAt.toISOString(),
      priority,
      reminder_minutes_before: Number(reminder),
      caseTitle: caseItem.title,
    };

    if (isEdit && id) {
      await updateDeadline.mutateAsync({ id, ...payload });
    } else {
      await createDeadline.mutateAsync(payload);
    }
    router.back();
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={isEdit ? t('deadlineForm.editTitle') : t('deadlineForm.newTitle')} subtitle={caseItem?.title} showBack />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <SuggestInput
            label={t('hearingForm.title')}
            placeholder={t('deadlineForm.titlePlaceholder')}
            value={title}
            onChangeText={setTitle}
            suggestions={deadlineTitleSuggestions[lang]}
          />

          <Text style={styles.label}>{t('deadlineForm.due')}</Text>
          <Pressable style={styles.dateButton} onPress={() => setShowPicker('date')}>
            <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
            <Text style={styles.dateButtonText}>{formatDateTime(dueAt.toISOString())}</Text>
          </Pressable>
          {showPicker && (
            <DateTimePicker
              value={dueAt}
              mode={showPicker}
              onChange={(_event, date) => {
                if (Platform.OS === 'android') {
                  setShowPicker(null);
                  if (date) {
                    if (showPicker === 'date') {
                      const next = new Date(dueAt);
                      next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                      setDueAt(next);
                      setTimeout(() => setShowPicker('time'), 250);
                    } else {
                      const next = new Date(dueAt);
                      next.setHours(date.getHours(), date.getMinutes());
                      setDueAt(next);
                    }
                  }
                } else if (date) {
                  setDueAt(date);
                }
              }}
            />
          )}
          {Platform.OS === 'ios' && showPicker && (
            <Button label={t('common.done')} size="sm" variant="secondary" onPress={() => setShowPicker(null)} style={styles.pickerDone} />
          )}

          <View style={styles.spacer} />
          <Text style={styles.label}>{t('caseForm.priority')}</Text>
          <SegmentedControl options={priorityOptions} value={priority} onChange={setPriority} />

          <View style={styles.spacer} />
          <Text style={styles.label}>{t('hearingForm.remind')}</Text>
          <SegmentedControl options={reminderOptions} value={reminder} onChange={setReminder} />

          <View style={styles.spacer} />
          <Input
            label={t('deadlineForm.description')}
            placeholder={t('deadlineForm.descPlaceholder')}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            style={styles.textArea}
          />

          <Button
            label={isEdit ? t('common.save') : t('deadlineForm.create')}
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

const styles = StyleSheet.create({
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
