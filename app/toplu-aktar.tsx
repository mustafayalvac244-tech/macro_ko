import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { dosyaMetni } from '@/lib/girdi';
import { uyar } from '@/lib/uyari';
import { useCreateCase } from '@/hooks/useCases';
import { useClients, useCreateClient } from '@/hooks/useClients';
import {
  ALAN_ADLARI,
  basliklariEslestir,
  csvAyristir,
  satirlariCevir,
  type Alan,
  type AktarimSonucu,
} from '@/utils/iceAktarim';
import { useT } from '@/i18n';
import { spacing, typography, kose } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

/**
 * TOPLU DOSYA AKTARIMI — başka bir programdan / UYAP'tan gelen tablo.
 *
 * NEDEN SÜTUN EŞLEMELİ. Kaynak biçimi önceden bilinmiyor ve bilinmesine
 * GEREK YOK: dosyanın kendi başlıklarını okuyup avukata "bu sütun ne?" diye
 * soruyoruz. Aynı ekran UYAP'ın Excel çıktısını, Sinerji'yi, KolayOfis'i ve
 * elle yapılmış bir listeyi alır.
 *
 * NEDEN ÖNCE KURU ÇALIŞTIRMA. Yazmadan önce ne yazılacağı gösteriliyor.
 * 300 satırlık bir dosyada yanlış eşleme, 300 bozuk dosya demek ve geri
 * alması elle temizlik demektir. Bir ekran fazladan dokunuş, o riskin
 * karşılığında ucuz.
 *
 * ATLANAN SATIR SESSİZ KALMAZ. Adlandırılamayan satırlar sebebiyle birlikte
 * listeleniyor; avukat 300 yükleyip 280 görürse hangilerinin kaybolduğunu
 * bilmek zorunda.
 *
 * ⚠️ ŞİMDİLİK YALNIZ CSV. Excel (.xlsx) sıkıştırılmış bir XML paketi ve onu
 * çözmek için kütüphane gerekiyor; depoya yeni bağımlılık eklemeden önce
 * gerçek bir UYAP çıktısı görülecek. Excel'den CSV'ye kaydetmek tek adım
 * olduğu için bu, aktarımı engellemiyor.
 */
export default function TopluAktarScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const t = useT();

  const createCase = useCreateCase();
  const createClient = useCreateClient();
  const { data: mevcutMuvekkiller } = useClients();

  const [dosyaAdi, setDosyaAdi] = useState<string | null>(null);
  const [basliklar, setBasliklar] = useState<string[]>([]);
  const [satirlar, setSatirlar] = useState<string[][]>([]);
  const [eslesme, setEslesme] = useState<Partial<Record<Alan, number>>>({});
  const [yaziliyor, setYaziliyor] = useState(false);
  const [ilerleme, setIlerleme] = useState(0);
  const [hata, setHata] = useState<string | null>(null);

  const onizleme: AktarimSonucu | null = useMemo(() => {
    if (!satirlar.length) return null;
    return satirlariCevir(satirlar, eslesme);
  }, [satirlar, eslesme]);

  const dosyaSec = async () => {
    setHata(null);
    try {
      const secim = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
      });
      if (secim.canceled || !secim.assets?.[0]) return;

      const asset = secim.assets[0];
      const metin = await dosyaMetni(asset);
      const tablo = csvAyristir(metin);

      if (tablo.length < 2) {
        setHata(t('toplu.tooShort'));
        return;
      }

      setDosyaAdi(asset.name ?? null);
      setBasliklar(tablo[0]);
      setSatirlar(tablo.slice(1));
      setEslesme(basliklariEslestir(tablo[0]));
    } catch {
      setHata(t('toplu.readFailed'));
    }
  };

  /** Bir alana sütun ata; aynı sütun başka alandaysa oradan alınır. */
  const sutunSec = (alan: Alan, indeks: number | null) => {
    setEslesme((onceki) => {
      const yeni: Partial<Record<Alan, number>> = { ...onceki };
      if (indeks == null) {
        delete yeni[alan];
        return yeni;
      }
      // Aynı sütun iki alana atanırsa ikisi de yanlış dolar.
      for (const a of Object.keys(yeni) as Alan[]) {
        if (yeni[a] === indeks) delete yeni[a];
      }
      yeni[alan] = indeks;
      return yeni;
    });
  };

  const aktar = async () => {
    if (!onizleme?.kayitlar.length) return;
    setYaziliyor(true);
    setIlerleme(0);
    setHata(null);

    // Müvekkil adı → kimlik. Var olanlar yeniden kullanılıyor; aynı adı iki
    // kez yazmak müvekkil listesini kopyalarla doldururdu.
    const muvekkilKimligi = new Map<string, string>();
    for (const m of mevcutMuvekkiller ?? []) {
      muvekkilKimligi.set(m.full_name.trim().toLocaleLowerCase('tr'), m.id);
    }

    try {
      for (let i = 0; i < onizleme.kayitlar.length; i += 1) {
        const k = onizleme.kayitlar[i];

        let clientId: string | undefined;
        if (k.muvekkil) {
          const anahtar = k.muvekkil.trim().toLocaleLowerCase('tr');
          const varOlan = muvekkilKimligi.get(anahtar);
          if (varOlan) {
            clientId = varOlan;
          } else {
            const yeni = await createClient.mutateAsync({
              full_name: k.muvekkil,
              company: null,
              email: null,
              phone: null,
              address: null,
              notes: null,
              title: null,
              client_type: 'gercek',
              tc_no: null,
            });
            clientId = yeni.id;
            muvekkilKimligi.set(anahtar, yeni.id);
          }
        }

        await createCase.mutateAsync({
          title: k.baslik,
          case_number: k.esasNo ?? undefined,
          court_name: k.mahkeme ?? undefined,
          case_type: k.davaTuru ?? undefined,
          opposing_party: k.karsiTaraf ?? undefined,
          opened_date: k.acilisTarihi ?? undefined,
          client_id: clientId,
        });

        setIlerleme(i + 1);
      }

      uyar(t('toplu.doneTitle'), t('toplu.doneBody', { adet: String(onizleme.kayitlar.length) }), [
        { text: t('common.ok'), onPress: () => router.back() },
      ]);
    } catch {
      // Kısmen yazılmış olabilir: ne kadarının geçtiğini SÖYLÜYORUZ, yoksa
      // avukat baştan yükler ve her şey ikilenir.
      setHata(t('toplu.partial', { adet: String(ilerleme) }));
    } finally {
      setYaziliyor(false);
    }
  };

  const alanlar = Object.keys(ALAN_ADLARI) as Alan[];

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('toplu.title')} showBack />
      <ScrollView contentContainerStyle={styles.content}>
        {!dosyaAdi ? (
          <Card>
            <Text style={styles.aciklama}>{t('toplu.intro')}</Text>
            <Text style={styles.notlar}>{t('toplu.csvOnly')}</Text>
            <Button label={t('toplu.pick')} icon="document-outline" onPress={dosyaSec} fullWidth />
          </Card>
        ) : (
          <>
            <Card>
              <View style={styles.dosyaSatir}>
                <Ionicons name="document-text-outline" size={18} color={colors.primary} />
                <Text style={styles.dosyaAdi} numberOfLines={1}>{dosyaAdi}</Text>
                <Pressable onPress={dosyaSec} hitSlop={8}>
                  <Text style={styles.degistir}>{t('toplu.change')}</Text>
                </Pressable>
              </View>
              <Text style={styles.satirSayisi}>
                {t('toplu.rowCount', { adet: String(satirlar.length) })}
              </Text>
            </Card>

            {/* ---- Sütun eşleme ---- */}
            <Card>
              <Text style={styles.bolumBaslik}>{t('toplu.mapTitle')}</Text>
              <Text style={styles.bolumNot}>{t('toplu.mapHint')}</Text>
              {alanlar.map((alan) => (
                <View key={alan} style={styles.alanBlok}>
                  <Text style={styles.alanAd}>{ALAN_ADLARI[alan]}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <Pressable
                      style={[styles.secenek, eslesme[alan] == null && styles.secenekSecili]}
                      onPress={() => sutunSec(alan, null)}
                    >
                      <Text style={[styles.secenekText, eslesme[alan] == null && styles.secenekTextSecili]}>
                        {t('toplu.none')}
                      </Text>
                    </Pressable>
                    {basliklar.map((b, i) => (
                      <Pressable
                        key={i}
                        style={[styles.secenek, eslesme[alan] === i && styles.secenekSecili]}
                        onPress={() => sutunSec(alan, i)}
                      >
                        <Text
                          style={[styles.secenekText, eslesme[alan] === i && styles.secenekTextSecili]}
                          numberOfLines={1}
                        >
                          {b.trim() || t('toplu.unnamedColumn', { no: String(i + 1) })}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ))}
            </Card>

            {/* ---- Kuru çalıştırma ---- */}
            {onizleme && (
              <Card>
                <Text style={styles.bolumBaslik}>{t('toplu.previewTitle')}</Text>
                <View style={styles.ozetSatir}>
                  <Text style={styles.ozetHazir}>
                    {t('toplu.ready', { adet: String(onizleme.kayitlar.length) })}
                  </Text>
                  {onizleme.atlananlar.length > 0 && (
                    <Text style={styles.ozetAtlanan}>
                      {t('toplu.skipped', { adet: String(onizleme.atlananlar.length) })}
                    </Text>
                  )}
                </View>

                {onizleme.kayitlar.slice(0, 3).map((k, i) => (
                  <View key={i} style={styles.onizSatir}>
                    <Text style={styles.onizBaslik} numberOfLines={1}>{k.baslik}</Text>
                    <Text style={styles.onizAlt} numberOfLines={1}>
                      {[k.esasNo, k.mahkeme, k.muvekkil].filter(Boolean).join(' · ') || '—'}
                    </Text>
                  </View>
                ))}
                {onizleme.kayitlar.length > 3 && (
                  <Text style={styles.dahaVar}>
                    {t('toplu.andMore', { adet: String(onizleme.kayitlar.length - 3) })}
                  </Text>
                )}

                {/* Atlananlar SESSİZ KALMAZ. */}
                {onizleme.atlananlar.slice(0, 5).map((a) => (
                  <View key={a.satirNo} style={styles.atlananSatir}>
                    <Ionicons name="alert-circle-outline" size={14} color={colors.warning} />
                    <Text style={styles.atlananText}>
                      {t('toplu.skippedRow', { no: String(a.satirNo), sebep: a.sebep })}
                    </Text>
                  </View>
                ))}
              </Card>
            )}

            {hata && (
              <View style={styles.hataKutu}>
                <Ionicons name="alert-circle" size={18} color={colors.danger} />
                <Text style={styles.hataText}>{hata}</Text>
              </View>
            )}

            <Button
              label={
                yaziliyor
                  ? t('toplu.writing', { n: String(ilerleme), toplam: String(onizleme?.kayitlar.length ?? 0) })
                  : t('toplu.start', { adet: String(onizleme?.kayitlar.length ?? 0) })
              }
              onPress={aktar}
              loading={yaziliyor}
              disabled={!onizleme?.kayitlar.length || yaziliyor}
              fullWidth
              size="lg"
              style={styles.aktarDugme}
            />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.sm },
    aciklama: { ...typography.body, color: colors.textPrimary, marginBottom: spacing.xs, lineHeight: 22 },
    notlar: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 18 },
    dosyaSatir: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    dosyaAdi: { ...typography.bodyMedium, color: colors.textPrimary, flex: 1 },
    degistir: { ...typography.caption, color: colors.primary },
    satirSayisi: { ...typography.small, color: colors.textSecondary, marginTop: spacing.xs },
    bolumBaslik: { ...typography.h3, color: colors.textPrimary, marginBottom: 4 },
    bolumNot: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 18 },
    alanBlok: { marginBottom: spacing.sm },
    alanAd: { ...typography.small, color: colors.textSecondary, marginBottom: 6 },
    secenek: {
      paddingVertical: 7,
      paddingHorizontal: spacing.sm,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
      marginRight: 6,
      maxWidth: 190,
    },
    secenekSecili: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    secenekText: { ...typography.caption, color: colors.textSecondary },
    secenekTextSecili: { color: colors.primary },
    ozetSatir: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm, flexWrap: 'wrap' },
    ozetHazir: { ...typography.bodyMedium, color: colors.success },
    ozetAtlanan: { ...typography.bodyMedium, color: colors.warning },
    onizSatir: {
      borderTopWidth: 1,
      borderTopColor: colors.borderSubtle,
      paddingVertical: spacing.xs,
    },
    onizBaslik: { ...typography.caption, color: colors.textPrimary },
    onizAlt: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
    dahaVar: { ...typography.small, color: colors.textSecondary, marginTop: spacing.xs },
    atlananSatir: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', marginTop: spacing.xs },
    atlananText: { ...typography.small, color: colors.warning, flex: 1, lineHeight: 16 },
    hataKutu: {
      flexDirection: 'row',
      gap: spacing.xs,
      backgroundColor: colors.dangerSoft,
      borderWidth: 1,
      borderColor: colors.danger,
      borderRadius: kose(12),
      padding: spacing.sm,
    },
    hataText: { ...typography.caption, color: colors.danger, flex: 1, lineHeight: 18 },
    aktarDugme: { marginTop: spacing.sm },
  });
