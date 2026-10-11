import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { indirilebilirMi, kopyalanabilirMi, metniIndir, metniKopyala, metniPaylas, paylasilabilirMi, type CiktiSonuc } from '@/lib/cikti';
import { ciktiBasarili, ciktiMesajAnahtari } from '@/lib/ciktiMesaji';
import { udfDisaAktar } from '@/lib/udfCikti';
import { useT } from '@/i18n';
import { radius, spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

interface Props {
  /** Dışarı çıkarılacak metin. */
  metin: string;
  /** Dosya adında kullanılacak başlık (ör. "Dilekçe Taslağı"). */
  baslik: string;
  /** Küçük yerleşim (sohbet balonu gibi dar alanlar için). */
  kucuk?: boolean;
  /**
   * UYAP (UDF) indirme düğmesi gösterilsin mi?
   *
   * YALNIZ MAHKEMEYE VERİLECEK METİNDE AÇILIR (dilekçe). Sohbet cevabı ya da
   * belge inceleme notu UYAP'a yüklenmez; oraya UDF düğmesi koymak, avukatı
   * işe yaramayacak bir dosyayla baş başa bırakır.
   */
  udf?: boolean;
  /**
   * Metin GERÇEKTEN dışarı çıktığında çağrılır (kopyala/indir/UDF/paylaş).
   * DuzenlenebilirCikti bunu "avukat düzeltmeyi bitirdi" işareti sayar.
   * Hata, desteklenmeme ve iptalde ÇAĞRILMAZ (09.10.2026: başarısız dışa
   * aktarma da "bitti" sayılıyordu).
   */
  onDisaAktar?: () => void;
  /**
   * Eylemden ÖNCE onay gerekiyorsa: `devam`ı çağırmak eylemi çalıştırır.
   * Verilmezse eylem doğrudan çalışır (teyitsiz atıf varsa sorulur —
   * bkz. DuzenlenebilirCikti.disaAktarOnayi).
   */
  onayIste?: (devam: () => void) => void;
}

/**
 * YAPAY ZEKÂ ÇIKTISININ DIŞARI ÇIKARILMASI.
 *
 * Web'de avukatın yapacağı ilk iş metni Word'e almaktır; doğru eylemler
 * KOPYALA ve İNDİR'dir. Telefonda ise paylaşım sayfası doğrudur (WhatsApp,
 * e-posta, Dosyalar). Bu bileşen platforma göre doğru düğmeleri gösterir.
 *
 * Önceki davranış web'de SESSİZCE HİÇBİR ŞEY YAPMIYORDU — bkz. src/lib/cikti.ts
 * başındaki ölçüm notu.
 */
export function CiktiEylemleri({ metin, baslik, kucuk = false, udf = false, onDisaAktar, onayIste }: Props) {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors, kucuk);
  const t = useT();

  const [durum, setDurum] = useState<CiktiSonuc | null>(null);
  const zamanlayici = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bileşen sökülürken bekleyen zamanlayıcı state güncellemeye çalışmasın.
  useEffect(() => () => {
    if (zamanlayici.current) clearTimeout(zamanlayici.current);
  }, []);

  const bildir = (s: CiktiSonuc) => {
    if (ciktiBasarili(s)) onDisaAktar?.();
    setDurum(s);
    if (zamanlayici.current) clearTimeout(zamanlayici.current);
    zamanlayici.current = setTimeout(() => setDurum(null), 2200);
  };

  const web = Platform.OS === 'web';
  const kopyaVar = kopyalanabilirMi();
  const indirVar = indirilebilirMi();
  // Web'de paylaş düğmesi YALNIZ gerçekten destekleniyorsa çizilir; yoksa
  // çalışmayan bir düğme göstermiş oluruz.
  const paylasVar = !web || paylasilabilirMi();

  // Eylemi (gerekirse onaydan sonra) çalıştırır ve sonucu bildirir.
  const calistir = (is: () => Promise<CiktiSonuc> | CiktiSonuc) => {
    const basla = async () => bildir(await is());
    if (onayIste) onayIste(() => void basla());
    else void basla();
  };

  const mesajAnahtari = durum ? ciktiMesajAnahtari(durum) : null;
  const durumMetni = mesajAnahtari ? t(mesajAnahtari) : null;

  return (
    <View style={styles.sarmal}>
      {!!durumMetni && (
        <Text style={[styles.durum, (durum === 'hata' || durum === 'desteklenmiyor') && styles.durumHata]}>
          {durumMetni}
        </Text>
      )}

      {kopyaVar && (
        <Pressable
          onPress={() => calistir(() => metniKopyala(metin))}
          hitSlop={8}
          style={styles.dugme}
          accessibilityLabel={t('cikti.copy')}
        >
          <Ionicons name="copy-outline" size={kucuk ? 15 : 18} color={colors.primary} />
          {!kucuk && <Text style={styles.dugmeMetni}>{t('cikti.copy')}</Text>}
        </Pressable>
      )}

      {indirVar && !kucuk && (
        <Pressable
          onPress={() => calistir(() => metniIndir(metin, baslik))}
          hitSlop={8}
          style={styles.dugme}
          accessibilityLabel={t('cikti.download')}
        >
          <Ionicons name="download-outline" size={18} color={colors.primary} />
          <Text style={styles.dugmeMetni}>{t('cikti.download')}</Text>
        </Pressable>
      )}

      {/* UYAP (UDF) — dilekçede en çok işe yarayan eylem. Uygulama bugüne
          kadar yalnız düz metin veriyordu; avukat onu UYAP Editör'e
          kopyalayıp biçimi elden geçirmek zorundaydı. Bkz. src/lib/udf.ts.
          Küçük yerleşimde (sohbet balonu) gösterilmez. */}
      {udf && !kucuk && (
        <Pressable
          onPress={() => calistir(() => udfDisaAktar(metin, baslik))}
          hitSlop={8}
          style={styles.dugme}
          accessibilityLabel={t('cikti.udf')}
        >
          <Ionicons name="document-attach-outline" size={18} color={colors.primary} />
          <Text style={styles.dugmeMetni}>{t('cikti.udf')}</Text>
        </Pressable>
      )}

      {paylasVar && (
        <Pressable
          onPress={() => calistir(() => metniPaylas(metin, baslik))}
          hitSlop={8}
          style={styles.dugme}
          accessibilityLabel={t('cikti.share')}
        >
          <Ionicons name="share-outline" size={kucuk ? 15 : 18} color={colors.primary} />
          {!kucuk && !web && <Text style={styles.dugmeMetni}>{t('cikti.share')}</Text>}
        </Pressable>
      )}
    </View>
  );
}

const makeStyles = (colors: ThemeColors, kucuk: boolean) => StyleSheet.create({
  sarmal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: kucuk ? spacing.xs : spacing.sm,
  },
  dugme: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: kucuk ? 2 : 4,
    paddingHorizontal: kucuk ? 4 : 8,
    borderRadius: radius.sm,
    backgroundColor: kucuk ? 'transparent' : colors.primarySoft,
  },
  dugmeMetni: {
    ...typography.small,
    fontWeight: '700',
    color: colors.primary,
  },
  durum: {
    ...typography.small,
    color: colors.success,
    marginRight: 2,
  },
  durumHata: {
    color: colors.danger,
  },
});
