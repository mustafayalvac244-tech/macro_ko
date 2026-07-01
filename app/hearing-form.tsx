import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useCase } from '@/hooks/useCases';
import { useCreateHearing, useHearingsForCase, useUpdateHearing } from '@/hooks/useHearings';
import { colors, spacing, typography } from '@/theme/theme';
import { formatDateTime } from '@/utils/format';
import type { HearingType } from '@/types/database';

const TYPE_OPTIONS: { label: string; value: HearingType }[] = [
  { label: 'Hearing', value: 'hearing' },
  { label: 'Trial', value: 'trial' },
  { label: 'Mediation', value: 'mediation' },
  { label: 'Deposition', value: 'deposition' },
  { label: 'Filing', value: 'filing' },
  { label: 'Meeting', value: 'meeting' },
  { label: 'Other', value: 'other' },
];

const REMINDER_OPTIONS = [
  { label: '30 min before', value: '30' },
  { label: '1 hour before', value: '60' },
  { label: '1 day before', value: '1440' },
  { label: '3 days before', value: '4320' },
  { label: '1 week before', value: '10080' },
];

export default function HearingFormScreen() {
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
      <ScreenHeader title={isEdit ? 'Edit Hearing' : 'New Hearing'} subtitle={caseItem?.title} showBack />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Input label="Title" placeholder="Preliminary Hearing" value={title} onChangeText={setTitle} />

          <Text style={styles.label}>Type</Text>
          <SegmentedControl options={TYPE_OPTIONS} value={type} onChange={setType} />

          <View style={styles.spacer} />
          <Text style={styles.label}>Scheduled date &amp; time</Text>
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
            <Button label="Done" size="sm" variant="secondary" onPress={() => setShowPicker(null)} style={styles.pickerDone} />
          )}

          <View style={styles.spacer} />
          <Input label="Location" placeholder="Courtroom 4B, 123 Justice Ave" value={location} onChangeText={setLocation} />

          <Text style={styles.label}>Remind me</Text>
          <SegmentedControl options={REMINDER_OPTIONS} value={reminder} onChange={setReminder} />

          <View style={styles.spacer} />
          <Input
            label="Notes"
            placeholder="Bring exhibits A-C, meet client 30 min prior..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            style={styles.textArea}
          />

          <Button
            label={isEdit ? 'Save Changes' : 'Schedule Hearing'}
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
