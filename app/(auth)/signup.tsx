import { useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { VekilLogo } from '@/components/ui/VekilLogo';
import { useAuthStore } from '@/store/authStore';
import { isValidTCKN } from '@/utils/tckn';
import { BAROLAR } from '@/constants/barolar';
import { useT } from '@/i18n';
import { radius, spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

export default function SignupScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);

  const t = useT();
  const [fullName, setFullName] = useState('');
  const [tcNo, setTcNo] = useState('');
  const [baro, setBaro] = useState('');
  const [barNumber, setBarNumber] = useState('');
  const [firmName, setFirmName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [baroPickerOpen, setBaroPickerOpen] = useState(false);
  const { signUp, isSubmitting, error, clearError } = useAuthStore();

  const canSubmit =
    !!fullName.trim() && !!email.trim() && !!password && !!tcNo.trim() && !!baro && !!barNumber.trim();

  const handleSubmit = async () => {
    clearError();
    setLocalError(null);

    if (!isValidTCKN(tcNo.trim())) {
      setLocalError(t('auth.tcInvalid'));
      return;
    }
    if (baro === '') {
      setLocalError(t('auth.baroRequired'));
      return;
    }
    if (barNumber.trim().length < 1) {
      setLocalError(t('auth.barNumberRequired'));
      return;
    }

    const success = await signUp({
      email: email.trim(),
      password,
      fullName: fullName.trim(),
      firmName: firmName.trim(),
      tcNo: tcNo.trim(),
      baro,
      barNumber: barNumber.trim(),
    });
    if (success) router.replace('/(app)');
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <VekilLogo size={72} nodeFill={colors.bg} />
            <Text style={styles.brandName}>{t('app.name')}</Text>
          </View>

          <View style={styles.lawyerBadge}>
            <Ionicons name="shield-checkmark" size={15} color={colors.primary} />
            <Text style={styles.lawyerBadgeText}>{t('auth.lawyersOnly')}</Text>
          </View>

          <Text style={styles.heading}>{t('auth.createHeading')}</Text>
          <Text style={styles.subheading}>{t('auth.signupSubtitle')}</Text>

          <Input label={t('auth.fullName')} icon="person-outline" placeholder={t('auth.fullNamePlaceholder')} value={fullName} onChangeText={setFullName} />

          <Input
            label={t('auth.tcNo')}
            icon="card-outline"
            keyboardType="number-pad"
            maxLength={11}
            placeholder={t('auth.tcPlaceholder')}
            value={tcNo}
            onChangeText={(v) => setTcNo(v.replace(/[^0-9]/g, ''))}
          />

          {/* Baro seçici */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('auth.baro')}</Text>
            <Pressable style={styles.selectBox} onPress={() => setBaroPickerOpen(true)}>
              <Ionicons name="business-outline" size={18} color={colors.textMuted} style={styles.selectIcon} />
              <Text style={[styles.selectText, !baro && styles.selectPlaceholder]}>
                {baro ? `${baro} Barosu` : t('auth.baroPlaceholder')}
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          <Input
            label={t('auth.barNumber')}
            icon="ribbon-outline"
            keyboardType="number-pad"
            placeholder={t('auth.barNumberPlaceholder')}
            value={barNumber}
            onChangeText={(v) => setBarNumber(v.replace(/[^0-9]/g, ''))}
          />

          <Input label={t('auth.firmName')} icon="briefcase-outline" placeholder={t('auth.firmNamePlaceholder')} value={firmName} onChangeText={setFirmName} />

          <Input
            label={t('auth.email')}
            icon="mail-outline"
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder={t('auth.emailPlaceholder')}
            value={email}
            onChangeText={setEmail}
          />
          <Input
            label={t('auth.password')}
            icon="lock-closed-outline"
            secureTextEntry
            placeholder={t('auth.passwordHint')}
            value={password}
            onChangeText={setPassword}
          />

          {(localError || error) && <Text style={styles.error}>{localError ?? error}</Text>}

          <Button
            label={t('auth.createAccountBtn')}
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={!canSubmit}
            fullWidth
            size="lg"
            style={styles.submit}
          />

          <View style={styles.trustRow}>
            <Pressable style={styles.trustItem} onPress={() => router.push('/privacy' as Parameters<typeof router.push>[0])}>
              <Ionicons name="lock-closed" size={15} color={colors.success} />
              <Text style={styles.trustText}>{t('auth.trustEncrypted')}</Text>
            </Pressable>
            <Pressable style={styles.trustItem} onPress={() => router.push('/privacy' as Parameters<typeof router.push>[0])}>
              <Ionicons name="shield-checkmark" size={15} color={colors.success} />
              <Text style={styles.trustText}>{t('auth.trustKvkk')}</Text>
            </Pressable>
            <Pressable style={styles.trustItem} onPress={() => router.push('/privacy' as Parameters<typeof router.push>[0])}>
              <Ionicons name="cloud-done" size={15} color={colors.success} />
              <Text style={styles.trustText}>{t('auth.trustCloud')}</Text>
            </Pressable>
          </View>
          <Text style={styles.privacyHint} onPress={() => router.push('/privacy' as Parameters<typeof router.push>[0])}>
            {t('auth.privacyLink')}
          </Text>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('auth.haveAccount')}</Text>
            <Link href="/(auth)/login" replace>
              <Text style={styles.footerLink}>{t('auth.signInLink')}</Text>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <BaroPicker
        visible={baroPickerOpen}
        onClose={() => setBaroPickerOpen(false)}
        onSelect={(b) => {
          setBaro(b);
          setBaroPickerOpen(false);
        }}
      />
    </Screen>
  );
}

function BaroPicker({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (baro: string) => void;
}) {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);
  const t = useT();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    if (!q) return BAROLAR;
    return BAROLAR.filter((b) => b.toLocaleLowerCase('tr').includes(q));
  }, [query]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{t('auth.baroPickTitle')}</Text>
          <View style={styles.modalSearch}>
            <Ionicons name="search-outline" size={17} color={colors.textMuted} />
            <TextInput
              style={styles.modalSearchInput}
              placeholder={t('auth.baroSearch')}
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoFocus
            />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(b) => b}
            keyboardShouldPersistTaps="handled"
            style={styles.modalList}
            renderItem={({ item }) => (
              <Pressable style={styles.modalRow} onPress={() => onSelect(item)}>
                <Ionicons name="business-outline" size={17} color={colors.primary} />
                <Text style={styles.modalRowText}>{item} Barosu</Text>
              </Pressable>
            )}
            ListEmptyComponent={<Text style={styles.modalEmpty}>{t('auth.baroNone')}</Text>}
          />
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
  },
  brand: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  brandName: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 5,
    textTransform: 'uppercase',
    marginTop: spacing.sm,
  },
  lawyerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    marginBottom: spacing.lg,
  },
  lawyerBadgeText: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '800',
  },
  heading: {
    ...typography.display,
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
  },
  subheading: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  field: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  selectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
  },
  selectIcon: {
    marginRight: spacing.xs,
  },
  selectText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 15,
  },
  selectPlaceholder: {
    color: colors.textMuted,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    marginBottom: spacing.md,
  },
  submit: {
    marginTop: spacing.xs,
  },
  trustRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  trustItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  trustText: {
    ...typography.small,
    color: colors.textSecondary,
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 14,
  },
  privacyHint: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    textDecorationLine: 'underline',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  footerText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  footerLink: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
  // Baro picker modal
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(10, 15, 30, 0.5)',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalSheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    maxHeight: '80%',
  },
  modalHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  modalSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  modalSearchInput: {
    flex: 1,
    color: colors.textPrimary,
    paddingVertical: 11,
    fontSize: 15,
  },
  modalList: {
    flexGrow: 0,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  modalRowText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  modalEmpty: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
});
