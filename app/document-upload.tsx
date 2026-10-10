import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { uyar } from '@/lib/uyari';
import { useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useCases } from '@/hooks/useCases';
import { useClients } from '@/hooks/useClients';
import { pickDocumentFile, pickImageFile, takePhotoFile, useDocuments, useUploadDocument } from '@/hooks/useDocuments';
import { useT } from '@/i18n';
import { spacing, typography, kose } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { formatFileSize } from '@/utils/format';
import { categoryMismatch, detectFileKind } from '@/utils/fileKind';
import type { DocumentCategory } from '@/types/database';
import { geriDon } from '@/lib/geriDon';
import { notifySaveError } from '@/lib/saveError';
import { useAuthStore } from '@/store/authStore';
import { fotoSecimSonucu } from '@/utils/profilKaydet';
import { BELGE_KATEGORILERI, belgeLimitHatasi, ucretsizBelgeLimitiDolu } from '@/utils/belgeArsivi';

const CATEGORY_VALUES: DocumentCategory[] = BELGE_KATEGORILERI;

export default function DocumentUploadScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);

  const t = useT();
  const { caseId: prefilledCaseId } = useLocalSearchParams<{ caseId?: string }>();
  const { data: cases } = useCases();
  const { data: clients } = useClients();
  const uploadDocument = useUploadDocument();
  const { data: belgeler, refetch: belgeleriYenile } = useDocuments();
  const profile = useAuthStore((s) => s.profile);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const [kontrolEdiliyor, setKontrolEdiliyor] = useState(false);

  const [ownerMode, setOwnerMode] = useState<'case' | 'client'>('case');
  const [caseId, setCaseId] = useState<string>(prefilledCaseId ?? '');
  const [clientId, setClientId] = useState<string>('');
  const [category, setCategory] = useState<DocumentCategory>('other');
  const [file, setFile] = useState<{ uri: string; name: string; size: number; mimeType: string | null } | null>(null);

  const categoryOptions = CATEGORY_VALUES.map((value) => ({ value, label: t(`docCategory.${value}` as const) }));

  // Seçici hatası SESSİZ kalmaz (10.10.2026 denetimi): kullanıcı düğmeye basıp
  // hiçbir şey olmadığını görüyordu.
  const handlePickDocument = async () => {
    try {
      const picked = await pickDocumentFile();
      if (picked) setFile(picked);
    } catch {
      uyar(t('upload.failed'), t('upload.tryAgain'));
    }
  };

  // Galeri/kamera izni reddedilince seçici de vazgeçme gibi null döner; ikisi
  // ayrılır ve ret kullanıcıya söylenir (kalıp: app/profile-form.tsx stagePhoto).
  // Web'de izin hep "verildi" döner.
  const handlePickPhoto = async (kaynak: 'galeri' | 'kamera') => {
    try {
      const picked = await (kaynak === 'kamera' ? takePhotoFile() : pickImageFile());
      const izinVerildi = picked
        ? true
        : await (kaynak === 'kamera'
            ? ImagePicker.getCameraPermissionsAsync()
            : ImagePicker.getMediaLibraryPermissionsAsync()
          ).then(
            (p) => p.granted,
            () => null,
          );
      if (fotoSecimSonucu(!!picked, izinVerildi) === 'izin-yok') {
        uyar(t('upload.title'), t(kaynak === 'kamera' ? 'profile.cameraPermDenied' : 'profile.photoPermDenied'));
        return;
      }
      if (picked) setFile(picked);
    } catch {
      uyar(t('upload.failed'), t('upload.tryAgain'));
    }
  };

  const handlePickImage = () => handlePickPhoto('galeri');
  const handleTakePhoto = () => handlePickPhoto('kamera');

  const detectedKind = file ? detectFileKind(file.mimeType, file.name) : null;

  const doUpload = async () => {
    if (!file) return;
    try {
      await uploadDocument.mutateAsync({
        file,
        caseId: ownerMode === 'case' ? caseId || null : null,
        clientId: ownerMode === 'client' ? clientId || null : null,
        category,
      });
      geriDon();
    } catch {
      // Uyarıyı kanca gösterir (notifySaveError): plan sınırı için "Planları
      // gör" düğmeli pencere, 25 MB için sınır cümlesi. Eskiden burada İKİNCİ
      // bir uyarı açılıyordu; web'de öncekinin yerine geçip doğru pencereyi
      // siliyor, ham "plan_limiti:belge:5" kodunu gösteriyordu (08.10.2026).
    }
  };

  // PLAN SINIRI ÖN KONTROLÜ (10.10.2026 denetimi). Ücretsiz planda 5 belge
  // dolduysa dosya önce okunup depoya yükleniyor, sınır hatası en sonda
  // geliyordu. Gerçek kısıt sunucudadır (0087); bu yalnız erken uyarıdır.
  // Profil/liste eski olabilir (abonelik az önce alınmış ya da belge başka
  // cihazdan silinmiş) — engellemeden önce ikisi de TAZELENİR; tazelenemezse
  // engellenmez, son sözü sunucu söyler.
  const limitDolduMu = async (): Promise<boolean> => {
    if (!ucretsizBelgeLimitiDolu(profile, belgeler?.length)) return false;
    const [, liste] = await Promise.all([refreshProfile(), belgeleriYenile()]);
    return ucretsizBelgeLimitiDolu(useAuthStore.getState().profile, liste.isError ? undefined : liste.data?.length);
  };

  const handleUpload = async () => {
    if (!file || !detectedKind) return;

    setKontrolEdiliyor(true);
    let dolu = false;
    try {
      dolu = await limitDolduMu();
    } catch {
      // Ön kontrol yapılamadı: engelleme, sunucu karar versin.
    } finally {
      setKontrolEdiliyor(false);
    }
    if (dolu) {
      notifySaveError(belgeLimitHatasi());
      return;
    }

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
      uyar(t('upload.mismatchTitle'), msg, [
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
        <Text style={styles.label}>{t('upload.attachTo')}</Text>
        <SegmentedControl
          scrollable={false}
          options={[
            { label: t('upload.byCase'), value: 'case' },
            { label: t('upload.byClient'), value: 'client' },
          ]}
          value={ownerMode}
          onChange={(v) => setOwnerMode(v as 'case' | 'client')}
        />

        <View style={styles.spacer} />
        {ownerMode === 'case' ? (
          <>
            <Text style={styles.label}>{t('upload.case')}</Text>
            <SegmentedControl
              options={[{ label: t('docs.myDocs'), value: '' }, ...(cases ?? []).map((c) => ({ label: c.title, value: c.id }))]}
              value={caseId}
              onChange={setCaseId}
            />
          </>
        ) : (
          <>
            <Text style={styles.label}>{t('upload.client')}</Text>
            <SegmentedControl
              options={[{ label: t('docs.myDocs'), value: '' }, ...(clients ?? []).map((c) => ({ label: c.full_name, value: c.id }))]}
              value={clientId}
              onChange={setClientId}
            />
          </>
        )}

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
          loading={uploadDocument.isPending || kontrolEdiliyor}
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
    borderRadius: kose(12),
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
