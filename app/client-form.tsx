import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useClient, useCreateClient, useUpdateClient } from '@/hooks/useClients';
import { useCases } from '@/hooks/useCases';
import { useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import { namesConflict } from '@/utils/nameMatch';

export default function ClientFormScreen() {
  const { colors } = useTheme();
  const t = useT();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;
  const { data: existingClient } = useClient(id);
  const { data: cases } = useCases();
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();

  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (existingClient) {
      setFullName(existingClient.full_name);
      setCompany(existingClient.company ?? '');
      setTitle(existingClient.title ?? '');
      setEmail(existingClient.email ?? '');
      setPhone(existingClient.phone ?? '');
      setAddress(existingClient.address ?? '');
      setNotes(existingClient.notes ?? '');
    }
  }, [existingClient]);

  const isSubmitting = createClient.isPending || updateClient.isPending;

  // Conflict-of-interest check: warn when this name appears as the opposing
  // party in an existing case.
  const conflictCase = useMemo(() => {
    const name = fullName.trim();
    if (name.length < 3) return null;
    return (cases ?? []).find((c) => c.opposing_party && namesConflict(c.opposing_party, name)) ?? null;
  }, [cases, fullName]);

  const handleSubmit = async () => {
    const payload = {
      full_name: fullName.trim(),
      company: company.trim() || null,
      title: title.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
      notes: notes.trim() || null,
    };

    if (isEdit && id) {
      await updateClient.mutateAsync({ id, ...payload });
    } else {
      await createClient.mutateAsync(payload);
    }
    router.back();
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={isEdit ? t('clientForm.editTitle') : t('clientForm.newTitle')} showBack />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Input label={t('clientForm.fullName')} placeholder={t('clientForm.fullNamePlaceholder')} value={fullName} onChangeText={setFullName} />
          {conflictCase && (
            <View
              style={[
                styles.warnBox,
                { backgroundColor: colors.warningSoft, borderColor: colors.warning },
              ]}
            >
              <Ionicons name="warning" size={18} color={colors.warning} />
              <Text style={[styles.warnText, { color: colors.textPrimary }]}>
                {t('conflict.clientWarn', { case: conflictCase.title })}
              </Text>
            </View>
          )}
          <Input label={t('clientForm.title')} placeholder={t('clientForm.titlePlaceholder')} value={title} onChangeText={setTitle} />
          <Input label={t('clientForm.company')} placeholder={t('clientForm.companyPlaceholder')} value={company} onChangeText={setCompany} />
          <Input
            label={t('clientForm.email')}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder={t('clientForm.emailPlaceholder')}
            value={email}
            onChangeText={setEmail}
          />
          <Input label={t('clientForm.phone')} keyboardType="phone-pad" placeholder={t('clientForm.phonePlaceholder')} value={phone} onChangeText={setPhone} />
          <Input label={t('clientForm.address')} placeholder={t('clientForm.addressPlaceholder')} value={address} onChangeText={setAddress} />
          <Input
            label={t('clientForm.notes')}
            placeholder={t('clientForm.notesPlaceholder')}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            style={styles.textArea}
          />

          <Button
            label={isEdit ? t('common.save') : t('clientForm.add')}
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={!fullName.trim()}
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
  textArea: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: 13,
  },
  submit: {
    marginTop: spacing.lg,
  },
  warnBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.sm,
    marginBottom: spacing.md,
    marginTop: -4,
  },
  warnText: {
    ...typography.caption,
    flex: 1,
    lineHeight: 18,
  },
});
