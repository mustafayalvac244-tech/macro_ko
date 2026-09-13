import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { DuzenlenebilirCikti } from '@/components/ui/DuzenlenebilirCikti';
import { useFinanceEntries } from '@/hooks/useFinance';
import { useAuthStore } from '@/store/authStore';
import { useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { makbuzMetni } from '@/utils/makbuzMetni';

/**
 * SERBEST MESLEK MAKBUZU DÖKÜMÜ EKRANI.
 *
 * NEDEN MÜŞTERİ ADI ELLE GİRİLİYOR. `finance_entries` tablosunda müvekkil bağı
 * YOK (ölçüldü: şemada client_id diye bir sütun bulunmuyor). Uydurmak ya da
 * boş bırakıp belgede eksik göstermek yerine, avukatın yazabileceği bir kutu
 * koyuldu. Tabloya müvekkil bağı eklenirse burası ön-doldurulur.
 *
 * NEDEN DÜZENLENEBİLİR ÇIKTI. Belge her büroda birebir aynı olmuyor (adres,
 * vergi dairesi, ek açıklama). Metni kilitlemek, avukatı çıktıyı başka bir
 * yere kopyalayıp elle düzeltmeye iter — ve o an bizim hesapladığımız rakamlar
 * da elle geçirilmiş olur. Düzenlemeye burada izin vermek daha güvenli.
 */
export default function MakbuzScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const t = useT();

  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: entries, isLoading } = useFinanceEntries();
  const profile = useAuthStore((s) => s.profile);

  const entry = useMemo(() => entries?.find((e) => e.id === id), [entries, id]);

  const [muvekkil, setMuvekkil] = useState('');
  const [makbuzNo, setMakbuzNo] = useState('');

  const cikti = useMemo(() => {
    if (!entry) return null;
    return makbuzMetni({
      makbuzNo: makbuzNo.trim() || entry.receipt_no,
      tarih: entry.entry_date,
      aciklama: entry.title,
      matrah: Number(entry.amount) || 0,
      kdvOrani: entry.vat_rate,
      stopajOrani: entry.withholding_rate,
      avukatAd: profile?.full_name ?? '',
      buro: profile?.firm_name,
      baroSicil: profile?.bar_number,
      muvekkilAd: muvekkil,
    });
  }, [entry, profile, muvekkil, makbuzNo]);

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('makbuz.title')} subtitle={entry?.title} showBack />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {!entry ? (
            <Card>
              <EmptyState
                icon="receipt-outline"
                title={t('makbuz.notFound')}
                description={isLoading ? t('makbuz.loading') : t('makbuz.notFoundDesc')}
              />
            </Card>
          ) : (
            <>
              <View style={styles.uyariKutu}>
                <Ionicons name="information-circle-outline" size={18} color={colors.warning} />
                <Text style={styles.uyariText}>{t('makbuz.notOfficial')}</Text>
              </View>

              <Input
                label={t('makbuz.client')}
                placeholder={t('makbuz.clientPlaceholder')}
                value={muvekkil}
                onChangeText={setMuvekkil}
                icon="person-outline"
              />
              <Input
                label={t('makbuz.no')}
                placeholder={entry.receipt_no ?? t('makbuz.noPlaceholder')}
                value={makbuzNo}
                onChangeText={setMakbuzNo}
                icon="pricetag-outline"
              />

              {cikti && (
                <DuzenlenebilirCikti
                  metin={cikti.metin}
                  baslik={t('makbuz.title')}
                  etiket={t('makbuz.documentLabel')}
                />
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
    uyariKutu: {
      flexDirection: 'row',
      gap: spacing.xs,
      backgroundColor: colors.warningSoft,
      borderRadius: 12,
      padding: spacing.sm,
      marginBottom: spacing.md,
    },
    uyariText: { ...typography.caption, color: colors.textSecondary, flex: 1, lineHeight: 18 },
  });
