import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { CiktiEylemleri } from '@/components/ui/CiktiEylemleri';
import { ciktiDuzeltmesiniBildir } from '@/lib/ciktiGeriBildirim';
import { useT } from '@/i18n';
import { radius, spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

/**
 * YAPAY ZEKÂ ÇIKTISI — OKUNUR VE DÜZENLENİR.
 *
 * NEDEN. Taslak bugüne kadar salt okunurdu: avukat metni kopyalayıp Word'e
 * alıyor, düzeltmeyi orada yapıyor, sonra UYAP'a oradan taşıyordu. Yani
 * ürettiğimiz UDF, avukatın GÖNDERECEĞİ metin değil, GÖNDERMEDEN ÖNCEKİ
 * hâliydi — UDF düğmesi pratikte yalnız hiç düzeltme gerektirmeyen taslaklarda
 * işe yarıyordu ki öyle taslak yok.
 *
 * Rakip karşılaştırmalarında Apilex'in öne çıkarılan tek somut üstünlüğü
 * "uygulama içinde düzenleme imkânı"ydı. Kapatılan şey bu.
 *
 * ÜÇ ŞEY BİLEREK BÖYLE:
 *   • Dışa aktarma (kopyala/indir/UDF) DÜZENLENMİŞ metni alır. Aksi hâlde
 *     avukat düzeltir, indirir ve düzeltmesiz dosyayı mahkemeye verirdi —
 *     düzenleme özelliğinin kendisi tuzağa dönüşürdü.
 *   • Değişiklik yapıldığı AÇIKÇA yazılır ve "aslına dön" hep durur. Metnin
 *     hangi kısmının bize, hangisinin avukata ait olduğu kaybolmamalı.
 *   • Sunucudan YENİ metin gelirse düzenleme sıfırlanır: yeni taslak, eski
 *     taslağın üstüne yazılmış düzeltmelerle karışmaz.
 */
interface Props {
  /** Sunucudan gelen asıl metin. Değişirse düzenleme sıfırlanır. */
  metin: string;
  /** Dosya adında kullanılacak başlık. */
  baslik: string;
  /** UYAP (UDF) düğmesi gösterilsin mi? Yalnız mahkemeye verilecek metinde. */
  udf?: boolean;
  /** Başlık satırının soluna konacak etiket (ör. "Taslak"). */
  etiket?: string;
  /**
   * ÖLÇÜM ALANLARI — verilirse avukatın düzeltme MİKTARI kaydedilir.
   * Metin ASLA gönderilmez, yalnız uzunluk ve değişim oranı
   * (bkz. src/lib/ciktiGeriBildirim.ts). Verilmezse ölçüm yapılmaz;
   * yani ölçüm, çağıranın açık tercihidir.
   */
  mod?: string;
  model?: string | null;
  istekId?: string | null;
  /**
   * Avukatın elindeki GÜNCEL metin (elle düzeltmeler dahil) her değiştiğinde.
   * "Yapay zekâya düzelttir" bu metni gönderir; asıl metni değil.
   */
  onMetinDegisti?: (metin: string) => void;
}

export function DuzenlenebilirCikti({ metin, baslik, udf = false, etiket, mod, model, istekId, onMetinDegisti }: Props) {
  const __t = useTheme();
  const styles = makeStyles(__t.colors);
  const t = useT();

  const [duzenlenen, setDuzenlenen] = useState(metin);
  const [acik, setAcik] = useState(false);
  const asil = useRef(metin);

  // ÖLÇÜM BİR KEZ GÖNDERİLİR. Her tuş vuruşunda göndermek hem gürültü
  // üretir hem avukatın yazarken ürettiği ara hâlleri "düzeltme" sayardı.
  const bildirildi = useRef(false);

  // YENİ TASLAK GELİNCE DÜZENLEME SIFIRLANIR. Kullanıcı "yeniden üret" dediğinde
  // ekranda eski metnin düzeltmeleri kalsaydı, hangi cümlenin yeni taslaktan
  // hangisinin eski düzeltmeden geldiği anlaşılmazdı.
  useEffect(() => {
    asil.current = metin;
    setDuzenlenen(metin);
    setAcik(false);
    bildirildi.current = false;
  }, [metin]);

  // DÜZENLEME PANELİ KAPANINCA ÖLÇÜMÜ GÖNDER.
  //
  // Neden kapanışta: "avukat düzeltmeyi bitirdi" anının en yakın işareti bu.
  // Kaydet düğmesi yok (metin zaten anlık kullanılıyor), bileşenin ayrılma
  // anı ise React'te güvenilir biçimde yakalanamıyor — ekran değiştiğinde
  // efekt temizliği ile ağ isteği yarışır.
  //
  // `mod` verilmemişse hiç ölçüm yapılmaz: ölçüm çağıranın açık tercihidir,
  // bileşenin sessiz yan etkisi değil.
  useEffect(() => {
    if (acik || !mod || bildirildi.current) return;
    if (duzenlenen === asil.current) return;
    bildirildi.current = true;
    void ciktiDuzeltmesiniBildir({ mod, model, istekId, asil: asil.current, son: duzenlenen });
  }, [acik, mod, model, istekId, duzenlenen]);

  // DIŞA AKTARMA DA "BİTTİ" SAYILIR (04.10.2026). Ölçüm yalnız "Bitti"ye
  // basınca gidiyordu; avukat düzeltip doğrudan UDF'ye basarsa hiç kayıt
  // düşmüyordu. Tablo o güne kadar 0 satırdı — düğmenin bulunmadığını mı,
  // ölçümün kaçtığını mı gösterdiği ayırt edilemiyordu.
  const disaAktarildi = () => {
    if (!mod || bildirildi.current || duzenlenen === asil.current) return;
    bildirildi.current = true;
    void ciktiDuzeltmesiniBildir({ mod, model, istekId, asil: asil.current, son: duzenlenen });
  };

  const bildirGuncel = useRef(onMetinDegisti);
  bildirGuncel.current = onMetinDegisti;
  useEffect(() => {
    bildirGuncel.current?.(duzenlenen);
  }, [duzenlenen]);

  const degisti = duzenlenen !== asil.current;
  // UZUN METİNDE ALTTA DA DÜĞME. Dilekçe birkaç ekran boyu; üstteki düğme,
  // avukat metni okuyup sona geldiğinde görünmüyor. Kısa çıktıda tekrar
  // gürültü olur, o yüzden yalnız uzun metinde.
  const altSatir = duzenlenen.length > 1200;

  // "DÜZELT" BİR DÜĞMEDİR, BAĞLANTI DEĞİL (04.10.2026, avukat geri bildirimi:
  // "üretilen dilekçeye düzeltme butonu eklenebilir"). Düzenleme özelliği
  // vardı ama 13 px'lik mavi bir yazıydı; ai_cikti_geri_bildirim tablosunda
  // o güne kadar tek satır yoktu. Avukat aradığı şeyi bulamadıysa özellik
  // yok demektir.
  const duzeltDugmesi = (
    <Pressable
      onPress={() => setAcik((v) => !v)}
      hitSlop={6}
      style={({ pressed }) => [styles.duzeltDugme, acik && styles.duzeltDugmeAcik, pressed && { opacity: 0.85 }]}
      accessibilityRole="button"
      accessibilityLabel={acik ? t('cikti.duzenlemeyiBitir') : t('cikti.duzenle')}
    >
      <Ionicons
        name={acik ? 'checkmark' : 'create-outline'}
        size={17}
        color={acik ? __t.colors.textInverse : __t.colors.primary}
      />
      <Text style={[styles.duzeltMetin, acik && styles.duzeltMetinAcik]}>
        {acik ? t('cikti.duzenlemeyiBitir') : t('cikti.duzenle')}
      </Text>
    </Pressable>
  );

  return (
    <View>
      <View style={styles.ustSatir}>
        {!!etiket && <Text style={styles.etiket}>{etiket}</Text>}
        <View style={styles.ustSag}>
          {duzeltDugmesi}
          {/* Dışa aktarma DÜZENLENMİŞ metni alır — bkz. dosya başındaki not. */}
          <CiktiEylemleri metin={duzenlenen} baslik={baslik} udf={udf} onDisaAktar={disaAktarildi} />
        </View>
      </View>

      {acik ? (
        <>
          <Text style={styles.ipucu}>{t('cikti.duzeltIpucu')}</Text>
          <TextInput
            value={duzenlenen}
            onChangeText={setDuzenlenen}
            multiline
            autoFocus
            style={styles.girdi}
            textAlignVertical="top"
            // Web'de uzun metinde otomatik büyüme yok; sabit yükseklik + kaydırma
            // daha öngörülebilir davranıyor.
            scrollEnabled
            accessibilityLabel={t('cikti.duzenle')}
          />
        </>
      ) : (
        <Text selectable style={styles.govde}>
          {duzenlenen}
        </Text>
      )}

      {degisti && (
        <View style={styles.degistiSatir}>
          <Text style={styles.degistiMetin}>{t('cikti.duzenlendi')}</Text>
          <Pressable onPress={() => setDuzenlenen(asil.current)} hitSlop={8} accessibilityRole="button">
            <Text style={styles.geriDon}>{t('cikti.aslinaDon')}</Text>
          </Pressable>
        </View>
      )}

      {altSatir && (
        <View style={styles.altSatir}>
          {duzeltDugmesi}
          <CiktiEylemleri metin={duzenlenen} baslik={baslik} udf={udf} onDisaAktar={disaAktarildi} />
        </View>
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    ustSatir: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginBottom: spacing.xs,
    },
    etiket: { ...typography.caption, color: colors.textSecondary },
    ustSag: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, flexShrink: 1 },
    duzeltDugme: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 36,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.sm,
      borderWidth: 1.5,
      borderColor: colors.primary,
      backgroundColor: colors.surface,
    },
    duzeltDugmeAcik: { backgroundColor: colors.primary },
    duzeltMetin: { ...typography.caption, color: colors.primary, fontWeight: '700' },
    duzeltMetinAcik: { color: colors.textInverse },
    ipucu: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs },
    altSatir: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.md,
      paddingTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    govde: { ...typography.body, color: colors.textPrimary, lineHeight: 22 },
    girdi: {
      ...typography.body,
      color: colors.textPrimary,
      lineHeight: 22,
      minHeight: 260,
      maxHeight: Platform.OS === 'web' ? 620 : undefined,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: radius.sm,
      padding: spacing.sm,
      backgroundColor: colors.surfaceAlt,
    },
    degistiSatir: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    degistiMetin: { ...typography.caption, color: colors.textSecondary, flexShrink: 1 },
    geriDon: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  });
}
