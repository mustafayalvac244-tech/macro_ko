import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Input } from '@/components/ui/Input';
import { SuggestInput } from '@/components/ui/SuggestInput';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useCreateJob } from '@/hooks/useJobs';
import { isMissingNetworkTables } from '@/hooks/useChat';
import { useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { formatDateTime } from '@/utils/format';
import type { JobType } from '@/types/database';

const CITY_SUGGESTIONS = [
  'İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Antalya', 'Adana', 'Konya', 'Gaziantep',
  'Kayseri', 'Mersin', 'Diyarbakır', 'Samsun', 'Eskişehir', 'Trabzon', 'Denizli',
];

export default function JobFormScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);

  const t = useT();
  const createJob = useCreateJob();

  const [jobType, setJobType] = useState<JobType>('tevkil');
  const [title, setTitle] = useState('');
  const [city, setCity] = useState('');
  const [courthouse, setCourthouse] = useState('');
  const [hearingAt, setHearingAt] = useState<Date | null>(null);
  const [fee, setFee] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState<'date' | 'time' | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!title.trim() || !city.trim()) {
      setError(t('jobForm.required'));
      return;
    }
    try {
      await createJob.mutateAsync({
        title: title.trim(),
        description: description.trim() || null,
        job_type: jobType,
        city: city.trim(),
        courthouse: courthouse.trim() || null,
        hearing_date: hearingAt ? hearingAt.toISOString() : null,
        fee_offer: fee.trim() ? Number(fee.replace(/\./g, '').replace(',', '.')) || null : null,
      });
      router.back();
    } catch (e) {
      setError(isMissingNetworkTables(e) ? t('network.setupRequired') : t('jobForm.failed'));
    }
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('jobForm.title')} showBack />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hintBox}>
            <Ionicons name="megaphone-outline" size={18} color={colors.info} />
            <Text style={styles.hintText}>{t('jobForm.hint')}</Text>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Text style={styles.label}>{t('jobForm.type')}</Text>
          <SegmentedControl
            scrollable={false}
            options={[
              { value: 'tevkil', label: t('jobType.tevkil') },
              { value: 'devir', label: t('jobType.devir') },
              { value: 'danisma', label: t('jobType.danisma') },
            ]}
            value={jobType}
            onChange={setJobType}
          />
          <Text style={styles.typeHint}>{t(`jobForm.typeHint.${jobType}` as const)}</Text>

          <View style={styles.spacer} />
          <Input
            label={t('jobForm.jobTitle')}
            placeholder={t('jobForm.jobTitlePlaceholder')}
            value={title}
            onChangeText={setTitle}
          />

          <SuggestInput
            label={t('jobForm.city')}
            placeholder="İstanbul"
            value={city}
            onChangeText={setCity}
            suggestions={CITY_SUGGESTIONS}
          />

          <Input
            label={t('jobForm.courthouse')}
            placeholder={t('jobForm.courthousePlaceholder')}
            value={courthouse}
            onChangeText={setCourthouse}
          />

          {jobType === 'tevkil' && (
            <>
              <Text style={styles.label}>{t('jobForm.hearingDate')}</Text>
              <View style={styles.hearingRow}>
                <Pressable style={[styles.dateButton, styles.hearingButton]} onPress={() => setShowPicker('date')}>
                  <Ionicons name="hammer-outline" size={18} color={hearingAt ? colors.primary : colors.textMuted} />
                  <Text style={[styles.dateButtonText, !hearingAt && { color: colors.textMuted }]}>
                    {hearingAt ? formatDateTime(hearingAt.toISOString()) : t('caseForm.pickDate')}
                  </Text>
                </Pressable>
                {hearingAt && (
                  <Pressable onPress={() => setHearingAt(null)} hitSlop={8}>
                    <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                  </Pressable>
                )}
              </View>
              {showPicker && (
                <DateTimePicker
                  value={hearingAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000)}
                  mode={Platform.OS === 'ios' ? 'datetime' : showPicker}
                  onChange={(_e, date) => {
                    const current = showPicker;
                    if (Platform.OS === 'android') setShowPicker(null);
                    if (!date) return;
                    if (Platform.OS === 'ios') {
                      setHearingAt(date);
                      return;
                    }
                    if (current === 'date') {
                      const base = hearingAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000);
                      const next = new Date(base);
                      next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                      setHearingAt(next);
                      setTimeout(() => setShowPicker('time'), 250);
                    } else {
                      const base = hearingAt ?? new Date();
                      const next = new Date(base);
                      next.setHours(date.getHours(), date.getMinutes());
                      setHearingAt(next);
                    }
                  }}
                />
              )}
              {Platform.OS === 'ios' && showPicker && (
                <Button label={t('common.done')} size="sm" variant="secondary" onPress={() => setShowPicker(null)} style={styles.pickerDone} />
              )}
              <View style={styles.spacer} />
            </>
          )}

          <Input
            label={t('jobForm.fee')}
            placeholder="2500"
            value={fee}
            onChangeText={setFee}
            keyboardType="decimal-pad"
            icon="cash-outline"
          />

          <Input
            label={t('jobForm.desc')}
            placeholder={t('jobForm.descPlaceholder')}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            style={styles.textArea}
          />

          <Button
            label={t('jobForm.publish')}
            onPress={handleSubmit}
            loading={createJob.isPending}
            disabled={!title.trim() || !city.trim()}
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
  hintBox: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.infoSoft,
    borderRadius: 12,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  hintText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  errorBox: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 12,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    flex: 1,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  typeHint: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.xs,
    lineHeight: 16,
  },
  spacer: {
    height: spacing.md,
  },
  hearingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  hearingButton: {
    flex: 1,
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
    height: 90,
    textAlignVertical: 'top',
    paddingTop: 13,
  },
  submit: {
    marginTop: spacing.lg,
  },
});
