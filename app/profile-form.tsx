import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { useAuthStore } from '@/store/authStore';
import { useAvatarUrl } from '@/hooks/useAvatarUrl';
import { pickImageFile, takePhotoFile } from '@/hooks/useDocuments';
import { useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

export default function ProfileFormScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);

  const t = useT();
  const profile = useAuthStore((s) => s.profile);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const uploadAvatar = useAuthStore((s) => s.uploadAvatar);
  const removeAvatar = useAuthStore((s) => s.removeAvatar);
  const avatarUrl = useAvatarUrl();

  const [fullName, setFullName] = useState('');
  const [firmName, setFirmName] = useState('');
  const [barNumber, setBarNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? '');
      setFirmName(profile.firm_name ?? '');
      setBarNumber(profile.bar_number ?? '');
      setPhone(profile.phone ?? '');
    }
  }, [profile]);

  const applyPhoto = async (picker: () => Promise<{ uri: string; mimeType: string | null } | null>) => {
    setError(null);
    const file = await picker();
    if (!file) return;
    setIsUploadingPhoto(true);
    try {
      await uploadAvatar(file);
    } catch {
      setError(t('profile.photoFailed'));
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handlePhotoPress = () => {
    const options: Array<{ text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }> = [
      { text: t('upload.choosePhoto'), onPress: () => applyPhoto(pickImageFile) },
      { text: t('upload.takePhoto'), onPress: () => applyPhoto(takePhotoFile) },
    ];
    if (profile?.avatar_url) {
      options.push({
        text: t('profile.removePhoto'),
        style: 'destructive',
        onPress: () => {
          removeAvatar().catch(() => setError(t('profile.photoFailed')));
        },
      });
    }
    options.push({ text: t('common.cancel'), style: 'cancel' });
    Alert.alert(t('profile.photoTitle'), undefined, options);
  };

  const handleSave = async () => {
    if (!fullName.trim()) return;
    setError(null);
    setIsSaving(true);
    try {
      await updateProfile({
        full_name: fullName.trim(),
        firm_name: firmName.trim() || null,
        bar_number: barNumber.trim() || null,
        phone: phone.trim() || null,
      });
      router.back();
    } catch {
      setError(t('profile.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('profile.editTitle')} showBack />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.photoSection}>
            <Pressable onPress={handlePhotoPress} disabled={isUploadingPhoto} style={styles.photoWrap}>
              <Avatar name={fullName || profile?.full_name || '?'} size={104} uri={avatarUrl} />
              <View style={[styles.photoBadge, { backgroundColor: colors.primary }]}>
                <Ionicons name={isUploadingPhoto ? 'hourglass' : 'camera'} size={15} color="#FFFFFF" />
              </View>
            </Pressable>
            <Text style={styles.photoHint}>{t('profile.photoHint')}</Text>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Input label={t('profile.fullName')} placeholder="Av. Ad Soyad" value={fullName} onChangeText={setFullName} />
          <Input label={t('profile.firmName')} placeholder={t('profile.firmPlaceholder')} value={firmName} onChangeText={setFirmName} />
          <Input
            label={t('profile.barNumber')}
            placeholder={t('profile.barPlaceholder')}
            value={barNumber}
            onChangeText={setBarNumber}
            keyboardType="numbers-and-punctuation"
          />
          <Input
            label={t('profile.phone')}
            placeholder="05xx xxx xx xx"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />

          <Button
            label={t('common.save')}
            onPress={handleSave}
            loading={isSaving}
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

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  photoWrap: {
    position: 'relative',
  },
  photoBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  photoHint: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
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
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    flex: 1,
  },
  submit: {
    marginTop: spacing.lg,
  },
});
