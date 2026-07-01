import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useClient, useCreateClient, useUpdateClient } from '@/hooks/useClients';
import { spacing } from '@/theme/theme';

export default function ClientFormScreen() {
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
      <ScreenHeader title={isEdit ? 'Edit Client' : 'New Client'} showBack />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Input label="Full name" placeholder="Jane Doe" value={fullName} onChangeText={setFullName} />
          <Input label="Company (optional)" placeholder="Doe Enterprises Inc." value={company} onChangeText={setCompany} />
          <Input label="Email" autoCapitalize="none" keyboardType="email-address" placeholder="jane@doeenterprises.com" value={email} onChangeText={setEmail} />
          <Input label="Phone" keyboardType="phone-pad" placeholder="(555) 123-4567" value={phone} onChangeText={setPhone} />
          <Input label="Address" placeholder="123 Main St, Springfield" value={address} onChangeText={setAddress} />
          <Input
            label="Notes"
            placeholder="Preferred contact method, background..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            style={styles.textArea}
          />

          <Button
            label={isEdit ? 'Save Changes' : 'Add Client'}
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
