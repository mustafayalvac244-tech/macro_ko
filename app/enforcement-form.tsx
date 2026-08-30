import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ClientPicker } from '@/components/ClientPicker';
import { useCreateEnforcement, useEnforcement, useUpdateEnforcement } from '@/hooks/useEnforcements';
import { useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { formatDate } from '@/utils/format';
import type { TakipType } from '@/types/database';

const TAKIP_TYPES: TakipType[] = ['ilamsiz', 'ilamli', 'kambiyo', 'kira', 'rehin'];

/** "12.500,75" → 12500.75; boş/geçersiz girişte 0. */
function parseMoney(s: string): number {
  const n = Number(s.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export default function EnforcementFormScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);
  const t = useT();

  const { id, clientId: clientIdParam } = useLocalSearchParams<{ id?: string; clientId?: string }>();
  const isEdit = !!id;
  const { data: existing } = useEnforcement(id);

  const createEnforcement = useCreateEnforcement();
  const updateEnforcement = useUpdateEnforcement();

  const [clientId, setClientId] = useState<string | null>(clientIdParam ?? null);
  const [debtorName, setDebtorName] = useState('');
  const [debtorId, setDebtorId] = useState('');
  const [debtorAddress, setDebtorAddress] = useState('');
  const [officeName, setOfficeName] = useState('');
  const [fileNumber, setFileNumber] = useState('');
  const [takipType, setTakipType] = useState<TakipType>('ilamsiz');
  const [principal, setPrincipal] = useState('');
  const [preInterest, setPreInterest] = useState('');
  const [rate, setRate] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [expenses, setExpenses] = useState('');
  const [attorneyFee, setAttorneyFee] = useState('');
  const [notes, setNotes] = useState('');
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (existing) {
      setClientId(existing.client_id);
      setDebtorName(existing.debtor_name);
      setDebtorId(existing.debtor_id_no ?? '');
      setDebtorAddress(existing.debtor_address ?? '');
      setOfficeName(existing.office_name ?? '');
      setFileNumber(existing.file_number ?? '');
      setTakipType(existing.takip_type);
      setPrincipal(String(existing.principal ?? ''));
      setPreInterest(existing.pre_interest ? String(existing.pre_interest) : '');
      setRate(existing.interest_rate != null ? String(existing.interest_rate) : '');
      setStartDate(new Date(`${existing.start_date}T12:00:00`));
      setExpenses(existing.expenses ? String(existing.expenses) : '');
      setAttorneyFee(existing.attorney_fee ? String(existing.attorney_fee) : '');
      setNotes(existing.notes ?? '');
    }
  }, [existing]);

  const isSubmitting = createEnforcement.isPending || updateEnforcement.isPending;
  const typeOptions = TAKIP_TYPES.map((value) => ({ value, label: t(`enf.type.${value}` as const) }));

  const handleSubmit = async () => {
    const payload = {
      client_id: clientId,
      debtor_name: debtorName.trim(),
      debtor_id_no: debtorId.trim() || null,
      debtor_address: debtorAddress.trim() || null,
      office_name: officeName.trim() || null,
      file_number: fileNumber.trim() || null,
      takip_type: takipType,
      principal: parseMoney(principal),
      pre_interest: parseMoney(preInterest),
      interest_rate: rate.trim() ? parseMoney(rate) : null,
      start_date: format(startDate, 'yyyy-MM-dd'),
      expenses: parseMoney(expenses),
      attorney_fee: parseMoney(attorneyFee),
      notes: notes.trim() || null,
    };

    // Hata durumunda kanca uyarı gösterir; formda kalıp bilgileri koruyoruz.
    try {
      if (isEdit && id) {
        await updateEnforcement.mutateAsync({ id, ...payload });
        router.back();
      } else {
        const created = await createEnforcement.mutateAsync(payload);
        router.replace(`/enforcement/${created.id}` as Parameters<typeof router.replace>[0]);
      }
    } catch {
      // uyarı notifySaveError ile gösterildi
    }
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={isEdit ? t('enf.editTitle') : t('enf.formTitle')} showBack />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hintBox}>
            <Ionicons name="information-circle-outline" size={18} color={colors.info} />
            <Text style={styles.hintText}>{t('enf.hint')}</Text>
          </View>

          <ClientPicker value={clientId} onChange={setClientId} />

          <Text style={styles.sectionTitle}>{t('enf.debtor')}</Text>
          <Input label={t('enf.debtorName')} value={debtorName} onChangeText={setDebtorName} placeholder="Mehmet Kaya / ABC Ltd. Şti." />
          <Input label={t('enf.debtorId')} value={debtorId} onChangeText={setDebtorId} keyboardType="number-pad" />
          <Input label={t('enf.debtorAddress')} value={debtorAddress} onChangeText={setDebtorAddress} />

          <Text style={styles.sectionTitle}>{t('enf.title')}</Text>
          <Input label={t('enf.office')} value={officeName} onChangeText={setOfficeName} placeholder={t('enf.officePlaceholder')} />
          <Input label={t('enf.fileNo')} value={fileNumber} onChangeText={setFileNumber} placeholder={t('enf.fileNoPlaceholder')} />

          <Text style={styles.label}>{t('enf.takipType')}</Text>
          <SegmentedControl options={typeOptions} value={takipType} onChange={setTakipType} />

          <View style={styles.spacer} />
          <Text style={styles.sectionTitle}>{t('enf.takipCikisi')}</Text>
          <Input label={t('enf.principal')} value={principal} onChangeText={setPrincipal} keyboardType="decimal-pad" />
          <Input label={t('enf.preInterest')} value={preInterest} onChangeText={setPreInterest} keyboardType="decimal-pad" />
          <Input label={t('enf.rate')} value={rate} onChangeText={setRate} keyboardType="decimal-pad" placeholder="24" />

          <Text style={styles.label}>{t('enf.startDate')}</Text>
          <Pressable style={styles.dateButton} onPress={() => setShowPicker(true)}>
            <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
            <Text style={styles.dateButtonText}>{formatDate(startDate.toISOString())}</Text>
          </Pressable>
          {showPicker && (
            <DateTimePicker locale="tr-TR"
              value={startDate}
              mode="date"
              display={Platform.OS === 'android' ? 'spinner' : 'default'}
              onChange={(_e, date) => {
                if (Platform.OS === 'android') setShowPicker(false);
                if (date) setStartDate(date);
              }}
            />
          )}
          {Platform.OS === 'ios' && showPicker && (
            <Button label={t('common.done')} size="sm" variant="secondary" onPress={() => setShowPicker(false)} style={styles.pickerDone} />
          )}

          <View style={styles.spacer} />
          <Input label={t('enf.expenses')} value={expenses} onChangeText={setExpenses} keyboardType="decimal-pad" />
          <Input label={t('enf.attorneyFee')} value={attorneyFee} onChangeText={setAttorneyFee} keyboardType="decimal-pad" />

          <Input
            label={t('enf.notes')}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            style={styles.textArea}
          />

          <Button
            label={isEdit ? t('common.save') : t('enf.create')}
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={!debtorName.trim()}
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
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
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
