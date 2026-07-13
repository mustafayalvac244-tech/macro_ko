import { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useCases } from '@/hooks/useCases';
import { useCreateDeadline } from '@/hooks/useDeadlines';
import { LEGAL_DEADLINES, LEGAL_DEADLINE_GROUPS, type LegalDeadlineGroup } from '@/constants/legalDeadlines';
import { computeLegalDue, recessRuleForGroup } from '@/utils/legalDates';
import { useLangStore, useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { formatDate } from '@/utils/format';

const REMINDER_VALUES = [
  { key: 'reminder.1d', value: '1440' },
  { key: 'reminder.3d', value: '4320' },
  { key: 'reminder.1w', value: '10080' },
] as const;

export default function DeadlineWizardScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);

  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const cases = useCases();
  const createDeadline = useCreateDeadline();

  const [group, setGroup] = useState<LegalDeadlineGroup>('hukuk');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notifiedAt, setNotifiedAt] = useState(new Date());
  const [caseId, setCaseId] = useState<string | null>(null);
  const [reminder, setReminder] = useState('4320');
  const [showPicker, setShowPicker] = useState(false);

  const groupOptions = LEGAL_DEADLINE_GROUPS.map((g) => ({ value: g, label: t(`wizard.group.${g}` as const) }));
  const items = LEGAL_DEADLINES.filter((d) => d.group === group);
  const selected = LEGAL_DEADLINES.find((d) => d.id === selectedId) ?? null;

  const result = useMemo(
    () => (selected ? computeLegalDue(notifiedAt, selected.amount, selected.unit, recessRuleForGroup(selected.group)) : null),
    [selected, notifiedAt]
  );

  const durationLabel = (amount: number, unit: 'day' | 'week' | 'month' | 'year') =>
    `${amount} ${t(`wizard.unit.${unit}` as const)}`;

  const openCases = (cases.data ?? []).filter((c) => c.status === 'active' || c.status === 'pending' || c.status === 'on_hold');
  const selectedCase = openCases.find((c) => c.id === caseId) ?? null;

  const handleCreate = async () => {
    if (!selected || !result || !selectedCase) return;
    const due = new Date(result.due);
    due.setHours(16, 0, 0, 0);
    const name = lang === 'tr' ? selected.tr : selected.en;
    try {
      await createDeadline.mutateAsync({
        case_id: selectedCase.id,
        title: name,
        description: t('wizard.taskDesc', { basis: selected.basis, date: formatDate(notifiedAt.toISOString()) }),
        due_at: due.toISOString(),
        priority: 'critical',
        reminder_minutes_before: Number(reminder),
        caseTitle: selectedCase.title,
      });
      Alert.alert(t('wizard.createdTitle'), t('wizard.createdMsg', { date: formatDate(due.toISOString()) }), [
        { text: t('common.done'), onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert(t('wizard.title'), t('financeForm.saveFailed'));
    }
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('wizard.title')} showBack />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hintBox}>
          <Ionicons name="hourglass-outline" size={18} color={colors.info} />
          <Text style={styles.hintText}>{t('wizard.hint')}</Text>
        </View>

        <Text style={styles.label}>{t('wizard.groupLabel')}</Text>
        <SegmentedControl options={groupOptions} value={group} onChange={(g) => { setGroup(g); setSelectedId(null); }} />

        <View style={styles.spacer} />
        <Text style={styles.label}>{t('wizard.typeLabel')}</Text>
        <View style={styles.itemList}>
          {items.map((item) => {
            const active = item.id === selectedId;
            return (
              <Pressable
                key={item.id}
                onPress={() => setSelectedId(item.id)}
                style={[styles.itemRow, active && styles.itemRowActive]}
              >
                <View style={styles.itemBody}>
                  <Text style={[styles.itemTitle, active && { color: colors.primary }]}>
                    {lang === 'tr' ? item.tr : item.en}
                  </Text>
                  <Text style={styles.itemBasis}>{item.basis}</Text>
                </View>
                <View style={[styles.durationBadge, active && { backgroundColor: colors.primary }]}>
                  <Text style={[styles.durationBadgeText, active && { color: '#FFFFFF' }]}>
                    {durationLabel(item.amount, item.unit)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.spacer} />
        <Text style={styles.label}>{t('wizard.notifiedAt')}</Text>
        <Pressable style={styles.dateButton} onPress={() => setShowPicker(true)}>
          <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
          <Text style={styles.dateButtonText}>{formatDate(notifiedAt.toISOString())}</Text>
        </Pressable>
        {showPicker && (
          <DateTimePicker
            value={notifiedAt}
            mode="date"
            onChange={(_e, date) => {
              if (Platform.OS === 'android') setShowPicker(false);
              if (date) setNotifiedAt(date);
            }}
          />
        )}
        {Platform.OS === 'ios' && showPicker && (
          <Button label={t('common.done')} size="sm" variant="secondary" onPress={() => setShowPicker(false)} style={styles.pickerDone} />
        )}

        {selected && result && (
          <Card style={styles.resultCard}>
            <Text style={styles.resultLabel}>{t('wizard.lastDay')}</Text>
            <Text style={styles.resultDate}>{formatDate(result.due.toISOString())}</Text>
            <Text style={styles.resultMeta}>
              {lang === 'tr' ? selected.tr : selected.en} · {selected.basis} · {durationLabel(selected.amount, selected.unit)}
            </Text>
            {result.extended && (
              <View style={styles.noticeRow}>
                <Ionicons name="information-circle" size={15} color={colors.info} />
                <Text style={[styles.noticeText, { color: colors.info }]}>
                  {t('wizard.extendedNote', { date: formatDate(result.raw.toISOString()) })}
                </Text>
              </View>
            )}
            {result.recessExtended && (
              <View style={styles.noticeRow}>
                <Ionicons name="information-circle" size={15} color={colors.info} />
                <Text style={[styles.noticeText, { color: colors.info }]}>
                  {t('wizard.recessExtendedNote', {
                    date: formatDate(result.raw.toISOString()),
                    rule: selected.group === 'ceza' ? t('wizard.recessRuleCriminal') : t('wizard.recessRuleCivil'),
                  })}
                </Text>
              </View>
            )}
            {result.religiousWarn && (
              <View style={styles.noticeRow}>
                <Ionicons name="warning" size={15} color={colors.warning} />
                <Text style={[styles.noticeText, { color: colors.warning }]}>{t('wizard.bayramNote')}</Text>
              </View>
            )}
            <Text style={styles.disclaimer}>{t('wizard.disclaimer')}</Text>
          </Card>
        )}

        {selected && (
          <>
            <View style={styles.spacer} />
            <Text style={styles.label}>{t('wizard.caseLabel')}</Text>
            {openCases.length > 0 ? (
              <SegmentedControl
                options={openCases.map((c) => ({ label: c.title, value: c.id }))}
                value={caseId ?? ''}
                onChange={(v) => setCaseId(v)}
              />
            ) : (
              <Text style={styles.noCases}>{t('wizard.noCases')}</Text>
            )}

            <View style={styles.spacer} />
            <Text style={styles.label}>{t('hearingForm.remind')}</Text>
            <SegmentedControl
              scrollable={false}
              options={REMINDER_VALUES.map(({ key, value }) => ({ value, label: t(key) }))}
              value={reminder}
              onChange={setReminder}
            />

            <Button
              label={t('wizard.createTask')}
              onPress={handleCreate}
              loading={createDeadline.isPending}
              disabled={!caseId || !result}
              fullWidth
              size="lg"
              style={styles.submit}
            />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
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
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  spacer: {
    height: spacing.md,
  },
  itemList: {
    gap: spacing.xs,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
  },
  itemRowActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  itemBody: {
    flex: 1,
  },
  itemTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  itemBasis: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: 1,
  },
  durationBadge: {
    backgroundColor: colors.surfaceHover,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  durationBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
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
  resultCard: {
    marginTop: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
  },
  resultLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  resultDate: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.primary,
    marginTop: 2,
  },
  resultMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    marginTop: spacing.sm,
    alignSelf: 'stretch',
  },
  noticeText: {
    ...typography.small,
    flex: 1,
    lineHeight: 16,
  },
  disclaimer: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
    lineHeight: 15,
  },
  noCases: {
    ...typography.caption,
    color: colors.warning,
  },
  submit: {
    marginTop: spacing.lg,
  },
});
