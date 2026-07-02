import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useClient, useCreateClient, useUpdateClient } from '@/hooks/useClients';
import { useT } from '@/i18n';
import { spacing } from '@/theme/theme';

export default function ClientFormScreen() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;
  const { data: existingClient } = useClient(id);
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();

  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (existingClient) {
      setFullName(existingClient.full_name);
      setCompany(existingClient.company ?? '');
      setEmail(existingClient.email ?? '');
      setPhone(existingClient.phone ?? '');
      setAddress(existingClient.address ?? '');
      setNotes(existingClient.notes ?? '');
    }
  }, [existingClient]);

  const isSubmitting = createClient.isPending || updateClient.isPending;

  const handleSubmit = async () => {
    const payload = {
      full_name: fullName.trim(),
      company: company.trim() || null,
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
});
