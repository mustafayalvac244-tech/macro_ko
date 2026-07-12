import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Input } from '@/components/ui/Input';
import { SuggestInput } from '@/components/ui/SuggestInput';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useCase, useCreateCase, useUpdateCase } from '@/hooks/useCases';
import { useCreateHearing } from '@/hooks/useHearings';
import { useClients } from '@/hooks/useClients';
import { useLangStore, useT } from '@/i18n';
import { trError } from '@/lib/authErrors';
import { caseTypeSuggestions, courtSuggestions } from '@/constants/suggestions';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { formatDate, formatDateTime } from '@/utils/format';
import { namesConflict } from '@/utils/nameMatch';
import type { CaseStatus, PriorityLevel } from '@/types/database';

const STATUS_VALUES: CaseStatus[] = ['active', 'pending', 'on_hold', 'won', 'lost', 'closed'];
const PRIORITY_VALUES: PriorityLevel[] = ['low', 'medium', 'high', 'critical'];

export default function CaseFormScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);

  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const { id, clientId: prefilledClientId } = useLocalSearchParams<{ id?: string; clientId?: string }>();
  const isEdit = !!id;
  const { data: existingCase } = useCase(id);
  const { data: clients } = useClients();
  const createCase = useCreateCase();
  const updateCase = useUpdateCase();
  const createHearing = useCreateHearing();

  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState<string | null>(prefilledClientId ?? null);
  const [caseNumber, setCaseNumber] = useState('');
  const [courtName, setCourtName] = useState('');
  const [courtCategory, setCourtCategory] = useState<'hukuk' | 'ceza' | 'idare'>('hukuk');
  const [caseType, setCaseType] = useState('');
  const [opposingParty, setOpposingParty] = useState('');
  const [opposingCounsel, setOpposingCounsel] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<CaseStatus>('active');
  const [priority, setPriority] = useState<PriorityLevel>('medium');
  const [openedDate, setOpenedDate] = useState(new Date());
  const [fee, setFee] = useState('');
  const [feeType, setFeeType] = useState<'percentage' | 'advance_percentage' | 'fixed'>('fixed');
  const [feePercent, setFeePercent] = useState('');
  const [feeAdvance, setFeeAdvance] = useState('');
  const [firstHearingAt, setFirstHearingAt] = useState<Date | null>(null);
  const [titleTouched, setTitleTouched] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState<'opened' | 'hearingDate' | 'hearingTime' | null>(null);

  useEffect(() => {
    if (existingCase) {
      setTitle(existingCase.title);
      setClientId(existingCase.client_id);
      setCaseNumber(existingCase.case_number ?? '');
      setCourtName(existingCase.court_name ?? '');
      setCourtCategory((existingCase.court_category as 'hukuk' | 'ceza' | 'idare') ?? 'hukuk');
      setCaseType(existingCase.case_type ?? '');
      setOpposingParty(existingCase.opposing_party ?? '');
      setOpposingCounsel(existingCase.opposing_counsel ?? '');
      setDescription(existingCase.description ?? '');
      setStatus(existingCase.status);
      setPriority(existingCase.priority);
      setOpenedDate(new Date(existingCase.opened_date));
      setFee(existingCase.fee_amount != null ? String(existingCase.fee_amount) : '');
      setFeeType((existingCase.fee_type as 'percentage' | 'advance_percentage' | 'fixed') ?? 'fixed');
      setFeePercent(existingCase.fee_percent != null ? String(existingCase.fee_percent) : '');
      setFeeAdvance(existingCase.fee_advance != null ? String(existingCase.fee_advance) : '');
    }
  }, [existingCase]);

  const isSubmitting = createCase.isPending || updateCase.isPending || createHearing.isPending;

  const statusOptions = STATUS_VALUES.map((value) => ({ value, label: t(`status.${value}` as const) }));
  const priorityOptions = PRIORITY_VALUES.map((value) => ({ value, label: t(`priority.${value}` as const) }));

  const titleError = titleTouched && !title.trim() ? t('caseForm.titleRequired') : null;

  // Conflict-of-interest check: warn (without blocking) when the opposing
  // party matches an existing client's name or company.
  const conflictClient = useMemo(() => {
    const op = opposingParty.trim();
    if (op.length < 3) return null;
    return (
      (clients ?? []).find(
        (c) => namesConflict(c.full_name, op) || (c.company ? namesConflict(c.company, op) : false)
      ) ?? null
    );
  }, [clients, opposingParty]);

  const handleSubmit = async () => {
    setTitleTouched(true);
    setSubmitError(null);
    if (!title.trim()) return;
    if (!opposingParty.trim()) {
      setSubmitError(t('caseForm.opposingRequired'));
      return;
    }

    const payload = {
      title: title.trim(),
      client_id: clientId,
      case_number: caseNumber.trim() || null,
      court_name: courtName.trim() || null,
      court_category: courtCategory,
      case_type: caseType.trim() || null,
      opposing_party: opposingParty.trim() || null,
      opposing_counsel: opposingCounsel.trim() || null,
      description: description.trim() || null,
      status,
      priority,
      opened_date: format(openedDate, 'yyyy-MM-dd'),
      fee_amount: fee.trim() ? Number(fee.replace(',', '.')) || null : null,
      fee_type: feeType,
      fee_percent: feePercent.trim() ? Number(feePercent.replace(',', '.')) || null : null,
      fee_advance: feeAdvance.trim() ? Number(feeAdvance.replace(',', '.')) || null : null,
    };

    try {
      if (isEdit && id) {
        await updateCase.mutateAsync({ id, ...payload });
      } else {
        const created = await createCase.mutateAsync(payload);
        if (firstHearingAt) {
          await createHearing.mutateAsync({
            case_id: created.id,
            title: t('hearingType.hearing'),
            type: 'hearing',
            location: courtName.trim() || null,
            scheduled_at: firstHearingAt.toISOString(),
            reminder_minutes_before: 1440,
            notes: null,
            caseTitle: created.title,
          });
        }
      }
      router.back();
    } catch (err) {
      setSubmitError(err instanceof Error ? trError(err.message) : t('caseForm.saveFailed'));
    }
  };

  const onPickerChange = (_event: unknown, date?: Date) => {
    const current = showPicker;
    if (Platform.OS === 'android') setShowPicker(null);
    if (!date || !current) return;

    if (current === 'opened') {
      setOpenedDate(date);
    } else if (current === 'hearingDate') {
      if (Platform.OS === 'ios') {
        // iOS uses a combined datetime picker
        setFirstHearingAt(date);
        return;
      }
      const base = firstHearingAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000);
      const next = new Date(base);
      next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
      setFirstHearingAt(next);
      setTimeout(() => setShowPicker('hearingTime'), 250);
    } else {
      const base = firstHearingAt ?? new Date();
      const next = new Date(base);
      next.setHours(date.getHours(), date.getMinutes());
      setFirstHearingAt(next);
    }
  };

  const pickerValue =
    showPicker === 'opened' ? openedDate : firstHearingAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000);

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={isEdit ? t('caseForm.editTitle') : t('caseForm.newTitle')} showBack />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Input
            label={t('caseForm.caseTitle')}
            placeholder={t('caseForm.caseTitlePlaceholder')}
            value={title}
            onChangeText={(v) => {
              setTitle(v);
              if (submitError) setSubmitError(null);
            }}
            onBlur={() => setTitleTouched(true)}
            error={titleError}
          />

          <Text style={styles.label}>{t('caseForm.client')}</Text>
          <SegmentedControl
            options={[{ label: t('common.none'), value: '' }, ...(clients ?? []).map((c) => ({ label: c.full_name, value: c.id }))]}
            value={clientId ?? ''}
            onChange={(v) => setClientId(v || null)}
          />

          <View style={styles.spacer} />
          <Input label={t('caseForm.caseNumber')} placeholder={t('caseForm.caseNumberPlaceholder')} value={caseNumber} onChangeText={setCaseNumber} />

          <Text style={styles.label}>{t('caseForm.courtCategory')}</Text>
          <SegmentedControl
            scrollable={false}
            options={[
              { value: 'hukuk', label: t('court.hukuk') },
              { value: 'ceza', label: t('court.ceza') },
              { value: 'idare', label: t('court.idare') },
            ]}
            value={courtCategory}
            onChange={(v) => setCourtCategory(v as 'hukuk' | 'ceza' | 'idare')}
          />
          <View style={styles.spacer} />
          <SuggestInput
            label={t('caseForm.court')}
            placeholder={t('caseForm.courtPlaceholder')}
            value={courtName}
            onChangeText={setCourtName}
            suggestions={courtSuggestions[lang]}
          />

          <SuggestInput
            label={t('caseForm.caseType')}
            placeholder={t('caseForm.caseTypePlaceholder')}
            value={caseType}
            onChangeText={setCaseType}
            suggestions={caseTypeSuggestions[lang]}
          />

          <Input label={t('caseForm.opposingPartyReq')} placeholder={t('caseForm.opposingPartyPlaceholder')} value={opposingParty} onChangeText={(v) => { setOpposingParty(v); if (submitError) setSubmitError(null); }} />
          <Input label={t('caseForm.opposingCounsel')} placeholder={t('caseForm.opposingCounselPlaceholder')} value={opposingCounsel} onChangeText={setOpposingCounsel} />

          {conflictClient && (
            <View style={styles.warnBox}>
              <Ionicons name="warning" size={18} color={colors.warning} />
              <Text style={styles.warnText}>{t('conflict.caseWarn', { name: conflictClient.full_name })}</Text>
            </View>
          )}

          <Text style={styles.label}>{t('fee.type')}</Text>
          <SegmentedControl
            scrollable={false}
            options={[
              { value: 'percentage', label: t('fee.percentage') },
              { value: 'advance_percentage', label: t('fee.advPercentage') },
              { value: 'fixed', label: t('fee.fixed') },
            ]}
            value={feeType}
            onChange={(v) => setFeeType(v as 'percentage' | 'advance_percentage' | 'fixed')}
          />
          <View style={styles.spacer} />
          {feeType === 'fixed' && (
            <Input label={t('fee.amount')} placeholder="50000" keyboardType="numeric" value={fee} onChangeText={setFee} />
          )}
          {feeType === 'percentage' && (
            <Input label={t('fee.percent')} placeholder="15" keyboardType="numeric" value={feePercent} onChangeText={setFeePercent} />
          )}
          {feeType === 'advance_percentage' && (
            <>
              <Input label={t('fee.advance')} placeholder="20000" keyboardType="numeric" value={feeAdvance} onChangeText={setFeeAdvance} />
              <Input label={t('fee.percent')} placeholder="10" keyboardType="numeric" value={feePercent} onChangeText={setFeePercent} />
            </>
          )}

          <Text style={styles.label}>{t('caseForm.openedDate')}</Text>
          <Pressable style={styles.dateButton} onPress={() => setShowPicker('opened')}>
            <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
            <Text style={styles.dateButtonText}>{formatDate(openedDate.toISOString())}</Text>
          </Pressable>

          {!isEdit && (
            <>
              <View style={styles.spacer} />
              <Text style={styles.label}>{t('caseForm.firstHearing')}</Text>
              <View style={styles.hearingRow}>
                <Pressable style={[styles.dateButton, styles.hearingButton]} onPress={() => setShowPicker('hearingDate')}>
                  <Ionicons name="hammer-outline" size={18} color={firstHearingAt ? colors.primary : colors.textMuted} />
                  <Text style={[styles.dateButtonText, !firstHearingAt && styles.dateButtonPlaceholder]}>
                    {firstHearingAt ? formatDateTime(firstHearingAt.toISOString()) : t('caseForm.pickDate')}
                  </Text>
                </Pressable>
                {firstHearingAt && (
                  <Pressable onPress={() => setFirstHearingAt(null)} hitSlop={8} style={styles.clearButton}>
                    <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                  </Pressable>
                )}
              </View>
            </>
          )}

          {showPicker && (
            <DateTimePicker
              value={pickerValue}
              mode={
                showPicker === 'hearingTime'
                  ? 'time'
                  : showPicker === 'hearingDate' && Platform.OS === 'ios'
                    ? 'datetime'
                    : 'date'
              }
              onChange={onPickerChange}
            />
          )}
          {Platform.OS === 'ios' && showPicker && (
            <Button label={t('common.done')} size="sm" variant="secondary" onPress={() => setShowPicker(null)} style={styles.pickerDone} />
          )}

          <View style={styles.spacer} />
          <Text style={styles.label}>{t('caseForm.status')}</Text>
          <SegmentedControl options={statusOptions} value={status} onChange={setStatus} />

          <View style={styles.spacer} />
          <Text style={styles.label}>{t('caseForm.priority')}</Text>
          <SegmentedControl options={priorityOptions} value={priority} onChange={setPriority} />

          <View style={styles.spacer} />
          <Input
            label={t('caseForm.description')}
            placeholder={t('caseForm.descriptionPlaceholder')}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            style={styles.textArea}
          />

          {submitError && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={colors.danger} />
              <Text style={styles.errorText}>{submitError}</Text>
            </View>
          )}

          <Button
            label={isEdit ? t('common.save') : t('caseForm.create')}
            onPress={handleSubmit}
            loading={isSubmitting}
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
  dateButtonPlaceholder: {
    color: colors.textMuted,
  },
  hearingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  hearingButton: {
    flex: 1,
  },
  clearButton: {
    padding: 4,
  },
  pickerDone: {
    marginTop: spacing.xs,
    alignSelf: 'flex-end',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 13,
  },
  submit: {
    marginTop: spacing.lg,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 12,
    padding: spacing.sm,
    marginTop: spacing.lg,
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
    marginBottom: spacing.md,
    marginTop: -4,
  },
  warnText: {
    ...typography.caption,
    color: colors.textPrimary,
    flex: 1,
    lineHeight: 18,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    flex: 1,
  },
});
