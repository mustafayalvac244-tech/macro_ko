import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useCases } from '@/hooks/useCases';
import { pickDocumentFile, pickImageFile, takePhotoFile, useUploadDocument } from '@/hooks/useDocuments';
import { useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { formatFileSize } from '@/utils/format';
import { categoryMismatch, detectFileKind } from '@/utils/fileKind';
import type { DocumentCategory } from '@/types/database';

const CATEGORY_VALUES: DocumentCategory[] = [
  'pleading',
  'contract',
  'evidence',
  'correspondence',
  'court_order',
  'invoice',
  'identification',
  'client_photo',
  'other',
];

export default function DocumentUploadScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);

  const t = useT();
  const { caseId: prefilledCaseId } = useLocalSearchParams<{ caseId?: string }>();
  const { data: cases } = useCases();
  const uploadDocument = useUploadDocument();

  const [caseId, setCaseId] = useState<string>(prefilledCaseId ?? '');
  const [category, setCategory] = useState<DocumentCategory>('other');
  const [file, setFile] = useState<{ uri: string; name: string; size: number; mimeType: string | null } | null>(null);

  const categoryOptions = CATEGORY_VALUES.map((value) => ({ value, label: t(`docCategory.${value}` as const) }));

  const handlePickDocument = async () => {
    const picked = await pickDocumentFile();
    if (picked) setFile(picked);
  };

  const handlePickImage = async () => {
    const picked = await pickImageFile();
    if (picked) setFile(picked);
  };

  const handleTakePhoto = async () => {
    const picked = await takePhotoFile();
    if (picked) setFile(picked);
  };

  const detectedKind = file ? detectFileKind(file.mimeType, file.name) : null;

  const doUpload = async () => {
    if (!file) return;
    try {
      await uploadDocument.mutateAsync({ file, caseId: caseId || null, category });
      router.back();
    } catch (err) {
      Alert.alert(t('upload.failed'), err instanceof Error ? err.message : t('upload.tryAgain'));
    }
  };

  const handleUpload = () => {
    if (!file || !detectedKind) return;

    // Smart check: warn (but allow override) if the file type clearly does not
    // match the chosen category.
    const mismatch = categoryMismatch(category, detectedKind);
    if (mismatch) {
      const kindLabel = t(`fileKind.${detectedKind}` as const);
      const catLabel = t(`docCategory.${category}` as const);
      const msg =
        mismatch.expected === 'photo'
          ? t('upload.mismatchPhoto', { cat: catLabel, kind: kindLabel })
          : t('upload.mismatchDoc', { cat: catLabel, kind: kindLabel });
      Alert.alert(t('upload.mismatchTitle'), msg, [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('upload.addAnyway'), style: 'destructive', onPress: doUpload },
      ]);
      return;
    }
    doUpload();
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('upload.title')} showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>{t('upload.case')}</Text>
        <SegmentedControl
          options={[{ label: t('docs.myDocs'), value: '' }, ...(cases ?? []).map((c) => ({ label: c.title, value: c.id }))]}
          value={caseId}
          onChange={setCaseId}
        />

        <View style={styles.spacer} />
        <Text style={styles.label}>{t('upload.category')}</Text>
        <SegmentedControl options={categoryOptions} value={category} onChange={setCategory} />

        <View style={styles.spacer} />
        <Card>
          {file && detectedKind ? (
            <View style={styles.filePreview}>
              <View style={styles.fileIconWrap}>
                <Ionicons
                  name={
                    detectedKind === 'image'
                      ? 'image-outline'
                      : detectedKind === 'pdf'
                        ? 'document-text-outline'
                        : detectedKind === 'word'
                          ? 'document-outline'
                          : 'document-attach-outline'
                  }
                  size={20}
                  color={colors.gold}
                />
              </View>
              <View style={styles.fileInfo}>
                <Text style={styles.fileName} numberOfLines={1}>
                  {file.name}
                </Text>
                <Text style={styles.fileMeta}>
                  {t('upload.detected', { kind: t(`fileKind.${detectedKind}` as const) })} · {formatFileSize(file.size)}
                </Text>
              </View>
              <Ionicons name="close-circle" size={20} color={colors.textMuted} onPress={() => setFile(null)} suppressHighlighting />
            </View>
          ) : (
            <View style={styles.pickerButtons}>
              <Button label={t('upload.chooseFile')} icon="document-outline" variant="secondary" onPress={handlePickDocument} style={styles.pickerButton} />
              <Button label={t('upload.choosePhoto')} icon="image-outline" variant="secondary" onPress={handlePickImage} style={styles.pickerButton} />
              <Button label={t('upload.takePhoto')} icon="camera-outline" variant="secondary" onPress={handleTakePhoto} style={styles.pickerButton} />
            </View>
          )}
        </Card>

        <Button
          label={t('upload.upload')}
          onPress={handleUpload}
          loading={uploadDocument.isPending}
          disabled={!file}
          fullWidth
          size="lg"
          style={styles.submit}
        />
      </ScrollView>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  spacer: {
    height: spacing.lg,
  },
  pickerButtons: {
    gap: spacing.sm,
  },
  pickerButton: {
    width: '100%',
  },
  filePreview: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  fileMeta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  submit: {
    marginTop: spacing.lg,
  },
});
