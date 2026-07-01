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
import { colors, spacing, typography } from '@/theme/theme';
import type { CaseStatus, PriorityLevel } from '@/types/database';

const STATUS_OPTIONS: { label: string; value: CaseStatus }[] = [
  { label: 'Active', value: 'active' },
  { label: 'Pending', value: 'pending' },
  { label: 'On Hold', value: 'on_hold' },
  { label: 'Won', value: 'won' },
  { label: 'Lost', value: 'lost' },
  { label: 'Closed', value: 'closed' },
];

const PRIORITY_OPTIONS: { label: string; value: PriorityLevel }[] = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
  { label: 'Critical', value: 'critical' },
];

export default function CaseFormScreen() {
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
      <ScreenHeader title={isEdit ? 'Edit Case' : 'New Case'} showBack />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Input label="Case title" placeholder="Smith v. Anderson Holdings" value={title} onChangeText={setTitle} />

          <Text style={styles.label}>Client</Text>
          <SegmentedControl
            options={[{ label: 'None', value: '' }, ...(clients ?? []).map((c) => ({ label: c.full_name, value: c.id }))]}
            value={clientId ?? ''}
            onChange={(v) => setClientId(v || null)}
          />

          <View style={styles.spacer} />
          <Input label="Case number" placeholder="CV-2026-00123" value={caseNumber} onChangeText={setCaseNumber} />
          <Input label="Court" placeholder="Superior Court of California" value={courtName} onChangeText={setCourtName} />
          <Input label="Case type" placeholder="Civil Litigation" value={caseType} onChangeText={setCaseType} />
          <Input label="Opposing party" placeholder="Anderson Holdings LLC" value={opposingParty} onChangeText={setOpposingParty} />

          <Text style={styles.label}>Status</Text>
          <SegmentedControl options={STATUS_OPTIONS} value={status} onChange={setStatus} />

          <View style={styles.spacer} />
          <Text style={styles.label}>Priority</Text>
          <SegmentedControl options={PRIORITY_OPTIONS} value={priority} onChange={setPriority} />

          <View style={styles.spacer} />
          <Input
            label="Description / notes"
            placeholder="Key facts, strategy notes, or context..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            style={styles.textArea}
          />

          <Button
            label={isEdit ? 'Save Changes' : 'Create Case'}
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
