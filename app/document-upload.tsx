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
import { pickDocumentFile, pickImageFile, useUploadDocument } from '@/hooks/useDocuments';
import { colors, spacing, typography } from '@/theme/theme';
import { formatFileSize } from '@/utils/format';
import type { DocumentCategory } from '@/types/database';

const CATEGORY_OPTIONS: { label: string; value: DocumentCategory }[] = [
  { label: 'Pleading', value: 'pleading' },
  { label: 'Contract', value: 'contract' },
  { label: 'Evidence', value: 'evidence' },
  { label: 'Correspondence', value: 'correspondence' },
  { label: 'Court Order', value: 'court_order' },
  { label: 'Invoice', value: 'invoice' },
  { label: 'ID', value: 'identification' },
  { label: 'Other', value: 'other' },
];

export default function DocumentUploadScreen() {
  const { caseId: prefilledCaseId } = useLocalSearchParams<{ caseId?: string }>();
  const { data: cases } = useCases();
  const uploadDocument = useUploadDocument();

  const [caseId, setCaseId] = useState<string>(prefilledCaseId ?? '');
  const [category, setCategory] = useState<DocumentCategory>('other');
  const [file, setFile] = useState<{ uri: string; name: string; size: number; mimeType: string | null } | null>(null);

  const handlePickDocument = async () => {
    const picked = await pickDocumentFile();
    if (picked) setFile(picked);
  };

  const handlePickImage = async () => {
    const picked = await pickImageFile();
    if (picked) setFile(picked);
  };

  const handleUpload = async () => {
    if (!file || !caseId) return;
    try {
      await uploadDocument.mutateAsync({ file, caseId, category });
      router.back();
    } catch (err) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Please try again.');
    }
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title="Upload Document" showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>Case</Text>
        {cases && cases.length > 0 ? (
          <SegmentedControl options={cases.map((c) => ({ label: c.title, value: c.id }))} value={caseId} onChange={setCaseId} />
        ) : (
          <Text style={styles.hint}>Create a case first to attach documents to it.</Text>
        )}

        <View style={styles.spacer} />
        <Text style={styles.label}>Category</Text>
        <SegmentedControl options={CATEGORY_OPTIONS} value={category} onChange={setCategory} />

        <View style={styles.spacer} />
        <Card>
          {file ? (
            <View style={styles.filePreview}>
              <View style={styles.fileIconWrap}>
                <Ionicons name="document-attach-outline" size={20} color={colors.gold} />
              </View>
              <View style={styles.fileInfo}>
                <Text style={styles.fileName} numberOfLines={1}>
                  {file.name}
                </Text>
                <Text style={styles.fileMeta}>{formatFileSize(file.size)}</Text>
              </View>
              <Ionicons name="close-circle" size={20} color={colors.textMuted} onPress={() => setFile(null)} suppressHighlighting />
            </View>
          ) : (
            <View style={styles.pickerButtons}>
              <Button label="Choose File" icon="document-outline" variant="secondary" onPress={handlePickDocument} style={styles.pickerButton} />
              <Button label="Choose Photo" icon="camera-outline" variant="secondary" onPress={handlePickImage} style={styles.pickerButton} />
            </View>
          )}
        </Card>

        <Button
          label="Upload"
          onPress={handleUpload}
          loading={uploadDocument.isPending}
          disabled={!file || !caseId}
          fullWidth
          size="lg"
          style={styles.submit}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pickerButton: {
    flex: 1,
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
