import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useT } from '@/i18n';
import { colors, spacing, typography } from '@/theme/theme';
import { formatDate } from '@/utils/format';

type FeedbackType = 'suggestion' | 'complaint';

interface FeedbackRow {
  id: string;
  type: FeedbackType;
  message: string;
  created_at: string;
}

export default function FeedbackScreen() {
  const t = useT();
  const ownerId = useAuthStore((s) => s.session?.user.id);
  const queryClient = useQueryClient();
  const [type, setType] = useState<FeedbackType>('suggestion');
  const [message, setMessage] = useState('');

  const previous = useQuery({
    queryKey: ['feedback', ownerId],
    enabled: !!ownerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feedback')
        .select('id, type, message, created_at')
        .eq('owner_id', ownerId!)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as FeedbackRow[];
    },
  });

  const send = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('feedback').insert({
        owner_id: ownerId!,
        type,
        message: message.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
      setMessage('');
      Alert.alert(t('settings.feedback'), t('feedback.thanks'), [{ text: t('common.done'), onPress: () => router.back() }]);
    },
    onError: () => Alert.alert(t('settings.feedback'), t('feedback.error')),
  });

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('settings.feedback')} showBack />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>{t('feedback.type')}</Text>
          <SegmentedControl
            scrollable={false}
            options={[
              { label: t('feedback.suggestion'), value: 'suggestion' },
              { label: t('feedback.complaint'), value: 'complaint' },
            ]}
            value={type}
            onChange={(v) => setType(v as FeedbackType)}
          />

          <View style={styles.spacer} />
          <Input
            label={t('feedback.message')}
            placeholder={t('feedback.placeholder')}
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={5}
            style={styles.textArea}
          />

          <Button
            label={t('feedback.send')}
            icon="paper-plane-outline"
            onPress={() => send.mutate()}
            loading={send.isPending}
            disabled={message.trim().length < 3}
            fullWidth
            size="lg"
          />

          {previous.data && previous.data.length > 0 && (
            <View style={styles.previousSection}>
              <Text style={styles.previousTitle}>{t('feedback.previous')}</Text>
              <Card>
                {previous.data.map((row, index) => (
                  <View key={row.id} style={index > 0 ? styles.divider : undefined}>
                    <View style={styles.previousRow}>
                      <Ionicons
                        name={row.type === 'suggestion' ? 'bulb-outline' : 'alert-circle-outline'}
                        size={16}
                        color={row.type === 'suggestion' ? colors.gold : colors.danger}
                        style={styles.previousIcon}
                      />
                      <View style={styles.previousBody}>
                        <Text style={styles.previousMeta}>
                          {t(row.type === 'suggestion' ? 'feedback.suggestion' : 'feedback.complaint')} · {formatDate(row.created_at)}
                        </Text>
                        <Text style={styles.previousMessage}>{row.message}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </Card>
            </View>
          )}
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
    height: 120,
    textAlignVertical: 'top',
    paddingTop: 13,
  },
  previousSection: {
    marginTop: spacing.xl,
  },
  previousTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  previousRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
  },
  previousIcon: {
    marginTop: 2,
    marginRight: spacing.xs,
  },
  previousBody: {
    flex: 1,
  },
  previousMeta: {
    ...typography.small,
    color: colors.textMuted,
    marginBottom: 2,
  },
  previousMessage: {
    ...typography.body,
    color: colors.textPrimary,
    lineHeight: 21,
  },
});
