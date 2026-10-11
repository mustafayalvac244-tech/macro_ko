import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BelgeEkleri } from '@/components/ui/BelgeEkleri';
import type { BelgeEki } from '@/lib/belgeEki';
import { ekGovdesi, metniSinirla, type EkUyari } from '@/lib/belgeEkiKurallari';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SesleYaz } from '@/components/ui/SesleYaz';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { DuzenlenebilirCikti } from '@/components/ui/DuzenlenebilirCikti';
import { HukukiUyari } from '@/components/ui/HukukiUyari';
import { AtifDenetimi, type KararDenetimiVerisi } from '@/components/ui/AtifDenetimi';
import { ComingSoon } from '@/components/ComingSoon';
import { AI_BELGE_ENABLED } from '@/config/features';
import { supabase } from '@/lib/supabase';
import { taslakOku, taslakSil, taslakYaz } from '@/lib/sohbetDeposu';
import { useAuthStore } from '@/store/authStore';
import { aiHataGovdesi, aiHataMetni } from '@/lib/aiHata';
import type { AiKullanim } from '@/hooks/useAiKontor';
import { useT } from '@/i18n';
import { fonts, spacing, shadow, kose } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { formatDateTime, formatMoney } from '@/utils/format';

/** İnceleme odağı — AI'ya "neye bakayım" talimatını belirler. */
type DocKind = 'sozlesme' | 'dilekce' | 'ihtarname' | 'karar' | 'diger';

const KINDS: DocKind[] = ['sozlesme', 'dilekce', 'ihtarname', 'karar', 'diger'];

/** Bağlam taşmasın diye üst sınır; aşarsa sondan kırpılır ve kaç karakterin gittiği söylenir. */
const MAX_CHARS = 12000;


/**
 * SON İNCELEME SONUCU CİHAZDA SAKLANIR (09.10.2026, 50 denetçi taraması).
 * Sonuç yalnız ekran durumundaydı: ücretli ve beklenen incelemeyi avukat
 * geri/yenile/yan menüyle çıkınca kaybediyordu. Dilekçe taslağıyla aynı kalıp
 * (src/lib/sohbetDeposu.ts): hesaba bağlı, çıkışta ve hesap silmede silinir.
 *
 * Sonuçla BİRLİKTE uyarılar da saklanır: uydurma madde/tutar, ayıklanan tarih,
 * taranmış sayfa ve yedek model uyarısı olmadan geri gelen bir inceleme
 * denetlenmiş gibi görünürdü. Yüklenen belge ve yapıştırılan metin SAKLANMAZ.
 */
type Taslak = {
  kind: DocKind;
  metin: string;
  ayiklanan: number;
  uydurmaMadde: string[];
  uydurmaTutar: number[];
  kararDenetimi: KararDenetimiVerisi | null;
  ekUyari: EkUyari | null;
  yedekModel: boolean;
  hakDusulmedi: boolean;
  zaman: number;
};

export default function DocumentReviewScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  const t = useT();

  const [kind, setKind] = useState<DocKind>('sozlesme');
  const [text, setText] = useState('');
  const [result, setResult] = useState('');
  // İncelemede geçip BELGEDE OLMAYAN tarihler sunucuda ayıklanıyor. Avukat
  // bunu bilmeli: belgeyi zaten okuduğunu varsayar ve incelemedeki bir tarihi
  // ajandasına yazabilir. Kaç tanesinin ayıklandığı, kalanları da denetlemesi
  // gerektiğinin işaretidir.
  const [ayiklanan, setAyiklanan] = useState(0);
  // Uydurma kanun maddesi atfı: sunucu artık havuzla karşılaştırıp söylüyor.
  const [uydurmaMadde, setUydurmaMadde] = useState<string[]>([]);
  const [kararDenetimi, setKararDenetimi] = useState<KararDenetimiVerisi | null>(null);
  const [uydurmaTutar, setUydurmaTutar] = useState<number[]>([]);
  // PDF'İN OKUNAMAYAN SAYFALARI (taranmış görüntü).
  //
  // En tehlikeli veri kaybı türü: avukat eksik olduğunu GÖREMİYOR. Resmî ücret
  // tarifesini kendi çıkarıcımızla okurken çıktı — 19.000 karakter metin geldi,
  // sekiz sayfanın dördü (ücret tabloları) hiç gelmedi. Sözleşmedeki ödeme
  // planı ya da karardaki hesap tablosu da aynı şekilde sessizce düşer ve
  // inceleme, belgenin tamamını görmüş gibi konuşur.
  // BELGE ARTIK EK OLARAK GİDER (04.10.2026, ürün sahibi: "PDF yükleme sadece
  // yazıları çıkarıyor"). Eskiden dosyanın metni bu ekrandaki kutuya dökülüp
  // düz metin olarak gönderiliyordu: taranmış sayfa, tablo, mühür kayboluyordu
  // ve tamamen taranmış PDF reddediliyordu. Şimdi PDF sayfa görüntüsüyle
  // okunur; kutu yapıştırılan metin ya da avukatın notu içindir.
  const [ekler, setEkler] = useState<BelgeEki[]>([]);
  // Kutu tavanı aşan yapıştırmayı keser; son kesimde KAÇ karakter gittiği
  // ekranda kalır (sessiz kayıp olmasın).
  const [kirpilan, setKirpilan] = useState(0);
  const metinYaz = (v: string) => {
    const s = metniSinirla(v, MAX_CHARS);
    setText(s.metin);
    setKirpilan(s.kirpilan);
  };
  const [ekUyari, setEkUyari] = useState<EkUyari | null>(null);
  // Kullanım ve iade — sunucu üç modda da destekliyor.
  const [kullanim, setKullanim] = useState<AiKullanim | null>(null);
  const [hakDusulmedi, setHakDusulmedi] = useState(false);
  // Yedek modelle üretildiyse SÖYLENİR (08.10.2026): sohbet gösteriyordu,
  // bu ekran göstermiyordu — Console askıdayken metni yedek model yazıyor.
  const [yedekModel, setYedekModel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const [geriYuklendi, setGeriYuklendi] = useState<number | null>(null);
  // Sonucun uyarı paketi (metin dışındaki her şey) ve diske en son yazılan metin.
  const paket = useRef<Omit<Taslak, 'metin' | 'zaman'> | null>(null);
  const sonYazilan = useRef('');
  const yeniAnaliz = useRef(false);
  const yazZamanlayici = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userId) return;
    let canli = true;
    taslakOku<Taslak>(userId, 'belge').then((k) => {
      // Okuma biterken kullanıcı yeni inceleme başlattıysa eskisi üstüne yazmaz.
      if (!canli || yeniAnaliz.current || !k?.metin) return;
      if (KINDS.includes(k.kind)) setKind(k.kind);
      setResult(k.metin);
      setAyiklanan(Number(k.ayiklanan ?? 0));
      setUydurmaMadde(k.uydurmaMadde ?? []);
      setUydurmaTutar(k.uydurmaTutar ?? []);
      setKararDenetimi(k.kararDenetimi ?? null);
      setEkUyari(k.ekUyari ?? null);
      setYedekModel(!!k.yedekModel);
      setHakDusulmedi(!!k.hakDusulmedi);
      paket.current = {
        kind: k.kind, ayiklanan: Number(k.ayiklanan ?? 0), uydurmaMadde: k.uydurmaMadde ?? [], uydurmaTutar: k.uydurmaTutar ?? [],
        kararDenetimi: k.kararDenetimi ?? null, ekUyari: k.ekUyari ?? null, yedekModel: !!k.yedekModel, hakDusulmedi: !!k.hakDusulmedi,
      };
      sonYazilan.current = k.metin;
      setGeriYuklendi(k.zaman);
    });
    return () => {
      canli = false;
    };
  }, [userId]);

  const sonucuSakla = (metin: string, hemen = false) => {
    if (!userId || !metin.trim() || !paket.current) return;
    // Bileşen açılışta aynı metni bir kez daha bildirir; değişmeyeni yazmak
    // "geri yüklendi" saatini boşuna ileri alırdı.
    if (metin === sonYazilan.current) return;
    sonYazilan.current = metin;
    if (yazZamanlayici.current) clearTimeout(yazZamanlayici.current);
    const yaz = () => {
      if (paket.current) taslakYaz(userId, 'belge', { ...paket.current, metin, zaman: Date.now() } satisfies Taslak);
    };
    if (hemen) yaz();
    else yazZamanlayici.current = setTimeout(yaz, 800);
  };
  const sonucuTemizle = () => {
    if (userId) taslakSil(userId, 'belge');
    if (yazZamanlayici.current) clearTimeout(yazZamanlayici.current);
    paket.current = null;
    sonYazilan.current = '';
    setResult('');
    setGeriYuklendi(null);
  };

  if (!AI_BELGE_ENABLED) {
    return <ComingSoon headerTitle={t('docrev.title')} title={t('soon.docrev')} desc={t('soon.desc')} icon="scan" />;
  }

  const analyze = async () => {
    const body = text.trim();
    // Ek varsa kutu yalnız nottur ve boş olabilir.
    if ((!ekler.length && body.length < 80) || busy) return;
    setBusy(true);
    yeniAnaliz.current = true;
    setError(null);
    setResult('');
    setGeriYuklendi(null);
    setHakDusulmedi(false);
    setYedekModel(false);
    try {
      // İNCELEME İSTEMİ SUNUCUDA. Burada kurulduğu sürece iki şey mümkün
      // değildi: incelemeyi ölçmek (ölçüm aracı istemi taklit etmek zorunda
      // kalırdı, yani kullanıcının gördüğü çıktı ölçülmezdi) ve istemi
      // uygulama güncellemesi olmadan iyileştirmek. Sunucu ayrıca belge
      // türüne göre mevzuat besliyor ve incelemede geçen ama BELGEDE OLMAYAN
      // tarihleri ayıklıyor.
      const { data, error: fnErr } = await supabase.functions.invoke('ai-chat', {
        body: { mode: 'belge', docKind: kind, question: body, ekler: ekler.length ? ekGovdesi(ekler) : undefined },
      });
      if (fnErr) {
        // Hata çevirisi ORTAK: aynı mantık üç ekranda ayrı yazılınca biri
        // güncellenip diğerleri geride kalıyordu (bkz. src/lib/aiHata.ts).
        const govde = await aiHataGovdesi(fnErr);
        const code = govde.error ?? '';
        setError(aiHataMetni(govde, t));
        return;
      }
      const yanit = data as { ekUyari?: EkUyari; text?: string; ayiklananTarih?: number; kullanim?: AiKullanim; hakDusulmedi?: boolean; yedekModel?: boolean; uydurmaMadde?: string[]; uydurmaTutar?: number[]; kararDenetimi?: KararDenetimiVerisi } | null;
      const reply = yanit?.text?.trim();
      if (!reply) {
        // Sunucuya ulaşıldı, cevap boş: internet suçlanmaz (08.10.2026).
        setError(t('ai.errTamamlanamadi'));
        return;
      }
      setResult(reply);
      setAyiklanan(Number(yanit?.ayiklananTarih ?? 0));
      setUydurmaMadde(yanit?.uydurmaMadde ?? []);
      setKararDenetimi(yanit?.kararDenetimi ?? null);
      setUydurmaTutar(yanit?.uydurmaTutar ?? []);
      setKullanim(yanit?.kullanim ?? null);
      setHakDusulmedi(!!yanit?.hakDusulmedi);
      setYedekModel(!!yanit?.yedekModel);
      setEkUyari(yanit?.ekUyari ?? null);
      // Eski sonuç YENİSİ GELENE KADAR silinmez: istek düşerse avukatın elindeki
      // sonuç da gitmiş olmasın.
      paket.current = {
        kind, ayiklanan: Number(yanit?.ayiklananTarih ?? 0), uydurmaMadde: yanit?.uydurmaMadde ?? [], uydurmaTutar: yanit?.uydurmaTutar ?? [],
        kararDenetimi: yanit?.kararDenetimi ?? null, ekUyari: yanit?.ekUyari ?? null, yedekModel: !!yanit?.yedekModel, hakDusulmedi: !!yanit?.hakDusulmedi,
      };
      sonYazilan.current = '';
      sonucuSakla(reply, true);
    } catch {
      setError(t('ai.errGeneric'));
    } finally {
      setBusy(false);
    }
  };

  const tooShort = !ekler.length && text.trim().length < 80;

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('docrev.title')} showBack />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.lead}>{t('docrev.lead')}</Text>

          <View style={styles.chips}>
            {KINDS.map((k) => (
              <Pressable key={k} onPress={() => setKind(k)} style={[styles.chip, kind === k && styles.chipActive]}>
                <Text style={[styles.chipText, kind === k && styles.chipTextActive]}>{t(`docrev.kind.${k}` as const)}</Text>
              </Pressable>
            ))}
          </View>

          <BelgeEkleri ekler={ekler} onChange={setEkler} disabled={busy} enCok={1} />

          <TextInput
            style={styles.area}
            value={text}
            onChangeText={metinYaz}
            placeholder={ekler.length ? t('docrev.ekNotPlaceholder') : t('docrev.placeholder')}
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
          />
          <View style={styles.metaRow}>
            <Text style={styles.meta}>{t('docrev.chars', { n: text.trim().length })}</Text>
            {kirpilan > 0 ? (
              <Text style={styles.metaWarn}>{t('docrev.kirpildi', { n: kirpilan, max: MAX_CHARS })}</Text>
            ) : (
              text.length >= MAX_CHARS && <Text style={styles.metaWarn}>{t('docrev.truncated')}</Text>
            )}
          </View>
          <SesleYaz metin={text} onChange={metinYaz} disabled={busy} />

          <Pressable
            onPress={analyze}
            disabled={tooShort || busy}
            style={({ pressed }) => [styles.cta, (tooShort || busy) && styles.ctaOff, pressed && { opacity: 0.85 }]}
          >
            {busy ? (
              <ActivityIndicator size="small" color={colors.textInverse} />
            ) : (
              <Ionicons name="sparkles" size={17} color={colors.textInverse} />
            )}
            <Text style={styles.ctaText}>{busy ? t('docrev.analyzing') : t('docrev.analyze')}</Text>
          </Pressable>

          {!!error && (
            <View style={styles.errBox}>
              <Ionicons name="alert-circle-outline" size={17} color={colors.danger} />
              <Text style={styles.errText}>{error}</Text>
            </View>
          )}

          {!!result && (
            <View style={styles.resultCard}>
              {geriYuklendi != null && (
                <View style={styles.geriYuklendi}>
                  <Text style={styles.usage}>{t('docrev.sonucGeriYuklendi', { zaman: formatDateTime(new Date(geriYuklendi).toISOString()) })}</Text>
                  <Pressable onPress={sonucuTemizle} hitSlop={8} accessibilityRole="button">
                    <Text style={styles.temizleText}>{t('docrev.sonucTemizle')}</Text>
                  </Pressable>
                </View>
              )}
              {/* Bulgular düzenlenebilir: avukat kendi notunu ekleyip dosyaya
                  öyle koyuyor. UDF YOK — inceleme notu mahkemeye verilmez. */}
              <DuzenlenebilirCikti
                metin={result}
                baslik={t('docrev.resultTitle')}
                etiket={t('docrev.resultTitle')}
                mod="belge"
                onMetinDegisti={(m) => sonucuSakla(m)}
              />
              <HukukiUyari tur="yapayZeka" />
              {/* SUNUCU BUNLARI GÖNDERİYORDU, EKRAN HİÇBİRİNİ GÖSTERMİYORDU.
                  Beş durum (uydurma madde, ayıklanan tarih, kullanım, hak
                  düşülmedi, iade) alınıp saklanıyor ama tek biri bile
                  çizilmiyordu; iade işlevi de yazılmış ama düğmesi yoktu.
                  Yani belge incelemesinde avukat ne harcadığını, neyin
                  ayıklandığını ve hakkını geri alabileceğini göremiyordu. */}
              {uydurmaMadde.length > 0 && (
                <Text style={styles.warn}>{t('ai.fakeArticles', { maddeler: uydurmaMadde.join(', ') })}</Text>
              )}
              <AtifDenetimi veri={kararDenetimi} />
              {uydurmaTutar.length > 0 && (
                <Text style={styles.warn}>
                  {t('ai.fakeAmounts', { tutarlar: uydurmaTutar.map((tt) => formatMoney(tt)).join(', ') })}
                </Text>
              )}
              {ayiklanan > 0 && (
                <Text style={styles.warn}>{t('dlk.scrubbedDates', { n: String(ayiklanan) })}</Text>
              )}
              {!!ekUyari?.taranmis && <Text style={styles.warn}>{t('ek.taranmisUyari')}</Text>}
              {!!ekUyari?.pdfdenMetne?.length && (
                <Text style={styles.warn}>{t('ek.metneDustu', { adlar: ekUyari.pdfdenMetne.join(', ') })}</Text>
              )}
              {!!ekUyari?.okunamayan?.length && (
                <Text style={styles.warn}>{t('ek.okunamayan', { adlar: ekUyari.okunamayan.join(', ') })}</Text>
              )}
              {ekUyari?.kirpilan?.map((k, i) => (
                <Text key={`kirpilan-${i}`} style={styles.warn}>{t('ek.kirpildi', { ad: k.ad, n: k.okunan, toplam: k.toplam })}</Text>
              ))}
              {!!kullanim && (
                <Text style={styles.usage}>
                  {kullanim.maliyetTL > 0
                    ? t('ai.usageCost', { token: String(kullanim.girdiToken + kullanim.ciktiToken), tl: kullanim.maliyetTL.toFixed(2) })
                    : t('ai.usageFree', { token: String(kullanim.girdiToken + kullanim.ciktiToken) })}
                </Text>
              )}
              {yedekModel && <Text style={[styles.usage, { color: colors.warning }]}>{t('ai.yedekModelMetin')}</Text>}
              {hakDusulmedi && <Text style={styles.usage}>{t('ai.notCharged')}</Text>}
              <Text style={styles.disclaimer}>{t('docrev.disclaimer')}</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1 },
  usage: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  geriYuklendi: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  temizleText: {
    fontFamily: fonts.semibold,
    fontSize: 12.5,
    color: colors.primary,
  },
  warn: {
    fontFamily: fonts.semibold,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.warning,
    marginTop: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  lead: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  chip: {
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  chipActive: {
    backgroundColor: colors.primary,
  },
  chipText: {
    fontFamily: fonts.semibold,
    fontWeight: '600',
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.textInverse,
  },
  area: {
    minHeight: 190,
    maxHeight: 320,
    backgroundColor: colors.surface,
    borderRadius: kose(16),
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.md,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: spacing.md,
  },
  meta: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
    color: colors.textMuted,
  },
  metaWarn: {
    fontFamily: fonts.semibold,
    fontWeight: '600',
    fontSize: 11.5,
    color: colors.warning,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: kose(14),
    paddingVertical: 15,
  },
  ctaOff: {
    opacity: 0.45,
  },
  ctaText: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    fontSize: 15,
    color: colors.textInverse,
  },
  errBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.dangerSoft,
    borderRadius: kose(12),
    padding: spacing.sm,
    marginTop: spacing.md,
  },
  errText: {
    fontFamily: fonts.medium,
    fontSize: 12.5,
    color: colors.danger,
    flex: 1,
    lineHeight: 18,
  },
  resultCard: {
    backgroundColor: colors.surface,
    borderRadius: kose(20),
    padding: spacing.lg,
    marginTop: spacing.lg,
    ...shadow.card,
  },
  resultHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  resultTitle: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: -0.3,
    color: colors.textPrimary,
  },
  resultText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textPrimary,
  },
  disclaimer: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
});
