import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { uyar } from '@/lib/uyari';
import { useDeleteTimeEntry, useTimeEntriesForCase } from '@/hooks/useTimeEntries';
import { useSayacStore } from '@/store/sayacStore';
import { useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { formatDate, formatMoney } from '@/utils/format';
import { shareCsv, toCsv } from '@/utils/exportCsv';
import { dakikaBicimle, gecenSureMetni, saateCevir, zamanOzeti } from '@/utils/zamanKaydi';

/**
 * DOSYANIN ÇALIŞMA KAYITLARI.
 *
 * İKİ GİRİŞ YOLU, TEK YAZMA YOLU. Süre ya sayaçla ölçülür ya elle yazılır;
 * ama kaydı her iki durumda da FORM yazar. Sayaç kendi başına kayıt
 * oluştursaydı iki yazma yolu olurdu ve ikisi zamanla ayrışırdı (doğrulama,
 * varsayılan ücret, "ne yapıldı" alanı — hepsi iki yerde tutulurdu).
 *
 * TOPLAMLARDA GİZLİ SIFIR YOK. Saatlik ücreti girilmemiş kayıtlar toplam
 * tutara girmez; bu SESSİZ kalırsa eksik fatura kesilir. Bu yüzden kaç
 * kaydın ücretsiz kaldığı toplamın hemen altında yazıyor.
 */
export function ZamanSekmesi({
  caseId,
  caseTitle,
}: {
  caseId: string;
  caseTitle: string;
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const t = useT();

  const { data: kayitlar, isLoading } = useTimeEntriesForCase(caseId);
  const sil = useDeleteTimeEntry();
  const sayac = useSayacStore();

  const buDosyadaCalisiyor = sayac.startedAt != null && sayac.caseId === caseId;
  const baskaDosyadaCalisiyor = sayac.startedAt != null && sayac.caseId !== caseId;

  // Sayaç metni saniyede bir tazeleniyor. Yalnız sayaç ÇALIŞIRKEN kurulan bir
  // aralık: kapalıyken her saniye render etmenin hiçbir karşılığı yok.
  const [, tazele] = useState(0);
  useEffect(() => {
    if (!buDosyadaCalisiyor) return;
    const it = setInterval(() => tazele((n) => n + 1), 1000);
    return () => clearInterval(it);
  }, [buDosyadaCalisiyor]);

  const ozet = useMemo(() => zamanOzeti(kayitlar ?? []), [kayitlar]);

  const formAc = (minutes?: number) =>
    router.push({
      pathname: '/time-entry-form',
      params: {
        caseId,
        caseTitle,
        ...(minutes != null ? { minutes: String(minutes) } : {}),
      },
    });

  const sayaciDurdur = () => {
    const dakika = sayac.durdur();
    formAc(dakika);
  };

  /**
   * Dökümü CSV olarak dışa ver — müvekkile/muhasebeciye giden ek budur.
   *
   * Süre hem "2 sa 15 dk" hem 2,25 olarak yazılıyor: ilki insan için, ikincisi
   * Excel'de çarpılabilsin diye. Tek biçim verseydik biri mutlaka elle
   * çevirmek zorunda kalırdı ve elle çevrim hata üretir.
   */
  const disaAktar = async () => {
    const satirlar = (kayitlar ?? []).map((k) => [
      formatDate(k.worked_at),
      k.description,
      dakikaBicimle(k.minutes),
      saateCevir(k.minutes),
      k.billable ? '' : t('time.unbilled'),
      k.hourly_rate ?? '',
      k.amount || '',
    ]);
    satirlar.push([
      '',
      t('time.total'),
      dakikaBicimle(ozet.toplamDakika),
      saateCevir(ozet.toplamDakika),
      '',
      '',
      ozet.toplamTutar || '',
    ]);
    const csv = toCsv(
      [
        t('time.workedAt'),
        t('time.description'),
        t('time.duration'),
        t('time.hoursColumn'),
        t('time.billable'),
        t('time.hourlyRate'),
        t('time.previewAmount'),
      ],
      satirlar,
    );
    await shareCsv(`calisma-${caseTitle}`, csv, t('time.title'));
  };

  const sayaciIptal = () =>
    uyar(t('time.timerCancel'), t('time.timerCancelConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => sayac.iptal() },
    ]);

  const kaydiSil = (id: string) =>
    uyar(t('time.deleteTitle'), t('time.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => sil.mutate(id) },
    ]);

  return (
    <View style={styles.wrap}>
      {/* ---- Sayaç ---- */}
      <Card>
        {buDosyadaCalisiyor ? (
          <View style={styles.sayacAcik}>
            <View style={styles.sayacSol}>
              <View style={styles.nokta} />
              <View>
                <Text style={styles.sayacLabel}>{t('time.timerRunning')}</Text>
                <Text style={styles.sayacSure}>{gecenSureMetni(sayac.startedAt!)}</Text>
              </View>
            </View>
            <View style={styles.sayacDugmeler}>
              <Pressable onPress={sayaciIptal} style={styles.iptalDugme} hitSlop={8}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </Pressable>
              <Button label={t('time.timerStop')} size="sm" onPress={sayaciDurdur} />
            </View>
          </View>
        ) : (
          <View style={styles.sayacKapali}>
            <Button
              label={t('time.timerStart')}
              icon="play"
              size="sm"
              variant="secondary"
              onPress={() => sayac.baslat(caseId, caseTitle)}
              disabled={baskaDosyadaCalisiyor}
            />
            <Button label={t('time.add')} icon="add" size="sm" onPress={() => formAc()} />
          </View>
        )}
        {baskaDosyadaCalisiyor && (
          <Text style={styles.mesgul}>
            {t('time.timerBusy', { dosya: sayac.caseTitle ?? '—' })}
          </Text>
        )}
      </Card>

      {/* ---- Toplamlar ---- */}
      {ozet.adet > 0 && (
        <Card>
          <View style={styles.ozetBas}>
            <Text style={styles.ozetBaslik}>{t('time.title')}</Text>
            <Pressable onPress={disaAktar} hitSlop={8} style={styles.disaAktarDugme}>
              <Ionicons name="download-outline" size={15} color={colors.primary} />
              <Text style={styles.disaAktarText}>{t('time.export')}</Text>
            </Pressable>
          </View>
          <View style={styles.ozetSatir}>
            <Ozet label={t('time.total')} deger={dakikaBicimle(ozet.toplamDakika)} styles={styles} />
            <Ozet
              label={t('time.billableTotal')}
              deger={dakikaBicimle(ozet.ucretliDakika)}
              styles={styles}
            />
            <Ozet
              label={t('time.amountTotal')}
              deger={formatMoney(ozet.toplamTutar)}
              styles={styles}
              vurgu
            />
          </View>
          {ozet.ucretsizKalan > 0 && (
            <View style={styles.uyariSatir}>
              <Ionicons name="alert-circle-outline" size={15} color={colors.warning} />
              <Text style={styles.uyariText}>
                {t('time.missingRate', { adet: String(ozet.ucretsizKalan) })}
              </Text>
            </View>
          )}
        </Card>
      )}

      {/* ---- Kayıtlar ---- */}
      {!isLoading && ozet.adet === 0 ? (
        <EmptyState
          icon="time-outline"
          title={t('time.empty')}
          description={t('time.emptyDesc')}
        />
      ) : (
        kayitlar?.map((k) => (
          <Card key={k.id}>
            <View style={styles.satir}>
              <View style={styles.satirSol}>
                <Text style={styles.aciklama}>{k.description}</Text>
                <Text style={styles.tarih}>
                  {formatDate(k.worked_at)}
                  {!k.billable ? ` · ${t('time.unbilled')}` : ''}
                </Text>
              </View>
              <View style={styles.satirSag}>
                <Text style={styles.sure}>{dakikaBicimle(k.minutes)}</Text>
                {k.billable && k.amount > 0 && (
                  <Text style={styles.tutar}>{formatMoney(k.amount)}</Text>
                )}
              </View>
              <Pressable onPress={() => kaydiSil(k.id)} hitSlop={8} style={styles.silDugme}>
                <Ionicons name="trash-outline" size={17} color={colors.textMuted} />
              </Pressable>
            </View>
          </Card>
        ))
      )}
    </View>
  );
}

function Ozet({
  label,
  deger,
  styles,
  vurgu,
}: {
  label: string;
  deger: string;
  styles: ReturnType<typeof makeStyles>;
  vurgu?: boolean;
}) {
  return (
    <View style={styles.ozetKutu}>
      <Text style={styles.ozetLabel}>{label}</Text>
      <Text style={[styles.ozetDeger, vurgu && styles.ozetVurgu]}>{deger}</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { gap: spacing.sm },
    sayacAcik: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      flexWrap: 'wrap',
    },
    sayacSol: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    nokta: { width: 9, height: 9, borderRadius: 999, backgroundColor: colors.danger },
    sayacLabel: { ...typography.small, color: colors.textSecondary },
    sayacSure: { ...typography.h2, color: colors.textPrimary, fontVariant: ['tabular-nums'] },
    sayacDugmeler: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    iptalDugme: { padding: spacing.xxs },
    sayacKapali: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
    mesgul: { ...typography.small, color: colors.warning, marginTop: spacing.xs },
    ozetBas: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    ozetBaslik: { ...typography.small, color: colors.textSecondary },
    disaAktarDugme: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    disaAktarText: { ...typography.small, color: colors.primary },
    ozetSatir: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
    ozetKutu: { flex: 1, minWidth: 90 },
    ozetLabel: { ...typography.small, color: colors.textSecondary, marginBottom: 2 },
    ozetDeger: { ...typography.h3, color: colors.textPrimary },
    ozetVurgu: { color: colors.primary },
    uyariSatir: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.sm,
    },
    uyariText: { ...typography.small, color: colors.warning, flex: 1, lineHeight: 16 },
    satir: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    satirSol: { flex: 1 },
    aciklama: { ...typography.bodyMedium, color: colors.textPrimary },
    tarih: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
    satirSag: { alignItems: 'flex-end' },
    sure: { ...typography.bodyMedium, color: colors.textPrimary },
    tutar: { ...typography.small, color: colors.primary, marginTop: 2 },
    silDugme: { padding: spacing.xxs },
  });
