import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useCase, useCreateCase, useUpdateCase } from '@/hooks/useCases';
import { useClients } from '@/hooks/useClients';
import { useT } from '@/i18n';
import { colors, spacing, typography } from '@/theme/theme';
import type { CaseStatus, PriorityLevel } from '@/types/database';

const STATUS_VALUES: CaseStatus[] = ['active', 'pending', 'on_hold', 'won', 'lost', 'closed'];
const PRIORITY_VALUES: PriorityLevel[] = ['low', 'medium', 'high', 'critical'];

export default function CaseFormScreen() {
  const t = useT();
  const { id, clientId: prefilledClientId } = useLocalSearchParams<{ id?: string; clientId?: string }>();
  const isEdit = !!id;
  const { data: existingCase } = useCase(id);
  const { data: clients } = useClients();
  const createCase = useCreateCase();
  const updateCase = useUpdateCase();

  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState<string | null>(prefilledClientId ?? null);
  const [caseNumber, setCaseNumber] = useState('');
  const [courtName, setCourtName] = useState('');
  const [caseType, setCaseType] = useState('');
  const [opposingParty, setOpposingParty] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<CaseStatus>('active');
  const [priority, setPriority] = useState<PriorityLevel>('medium');

  useEffect(() => {
    if (existingCase) {
      setTitle(existingCase.title);
      setClientId(existingCase.client_id);
      setCaseNumber(existingCase.case_number ?? '');
      setCourtName(existingCase.court_name ?? '');
      setCaseType(existingCase.case_type ?? '');
      setOpposingParty(existingCase.opposing_party ?? '');
      setDescription(existingCase.description ?? '');
      setStatus(existingCase.status);
      setPriority(existingCase.priority);
    }
  }, [existingCase]);

  const isSubmitting = createCase.isPending || updateCase.isPending;

  const statusOptions = STATUS_VALUES.map((value) => ({ value, label: t(`status.${value}` as const) }));
  const priorityOptions = PRIORITY_VALUES.map((value) => ({ value, label: t(`priority.${value}` as const) }));

  const handleSubmit = async () => {
    const payload = {
      title: title.trim(),
      client_id: clientId,
      case_number: caseNumber.trim() || null,
      court_name: courtName.trim() || null,
      case_type: caseType.trim() || null,
      opposing_party: opposingParty.trim() || null,
      description: description.trim() || null,
      status,
      priority,
    };

    if (isEdit && id) {
      await updateCase.mutateAsync({ id, ...payload });
    } else {
      await createCase.mutateAsync(payload);
    }
    router.back();
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={isEdit ? t('caseForm.editTitle') : t('caseForm.newTitle')} showBack />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Input label={t('caseForm.caseTitle')} placeholder={t('caseForm.caseTitlePlaceholder')} value={title} onChangeText={setTitle} />

          <Text style={styles.label}>{t('caseForm.client')}</Text>
          <SegmentedControl
            options={[{ label: t('common.none'), value: '' }, ...(clients ?? []).map((c) => ({ label: c.full_name, value: c.id }))]}
            value={clientId ?? ''}
            onChange={(v) => setClientId(v || null)}
          />

          <View style={styles.spacer} />
          <Input label={t('caseForm.caseNumber')} placeholder={t('caseForm.caseNumberPlaceholder')} value={caseNumber} onChangeText={setCaseNumber} />
          <Input label={t('caseForm.court')} placeholder={t('caseForm.courtPlaceholder')} value={courtName} onChangeText={setCourtName} />
          <Input label={t('caseForm.caseType')} placeholder={t('caseForm.caseTypePlaceholder')} value={caseType} onChangeText={setCaseType} />
          <Input label={t('caseForm.opposingParty')} placeholder={t('caseForm.opposingPartyPlaceholder')} value={opposingParty} onChangeText={setOpposingParty} />

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

          <Button
            label={isEdit ? t('common.save') : t('caseForm.create')}
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
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 13,
  },
  submit: {
    marginTop: spacing.lg,
  },
});
