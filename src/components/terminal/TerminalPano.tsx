import React, { useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { format } from 'date-fns/format';
import { tr as trLocale } from 'date-fns/locale/tr';
import { enUS } from 'date-fns/locale/en-US';
import { Screen } from '@/components/ui/Screen';
import { UstCubuk } from './UstCubuk';
import { useCases } from '@/hooks/useCases';
import { useAllHearings } from '@/hooks/useHearings';
import { useAllDeadlines } from '@/hooks/useDeadlines';
import { useFinanceEntries } from '@/hooks/useFinance';
import { useAuthStore } from '@/store/authStore';
import { useLangStore, useT } from '@/i18n';
import { kose, spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import { genisEkranMi } from '@/theme/duzen';
import type { ThemeColors } from '@/theme/palettes';
import { formatMoney } from '@/utils/format';

/**
 * TERMINAL PANOSU — ürün sahibinin onayladığı maketin pano karşılığı.
 *
 * NEDEN AYRI DOSYA, mevcut panonun içine koşul koymak yerine. Var olan pano
 * (app/(app)/index.tsx) ~1800 satır ve BEŞ tema için tasarlanmış: altın
 * gradyanlar, serif başlıklar, büyük kartlar. İki düzeni tek dosyada
 * iç içe koşullarla taşımak, iki düzeni de bozma riskini kalıcı hâle
 * getirirdi. Bu dosya YALNIZ Terminal temasında çiziliyor, diğer beş tema
 * eski panoyu olduğu gibi görüyor.
 *
 * SAYILARIN HEPSİ GERÇEK. Makette "tahsil ₺32.000 · gecikmiş ₺8.500" gibi
 * kalemler vardı; onlar maketin KURGU verisiydi. Burada yalnız uygulamanın
 * gerçekten hesapladığı değerler var (açık dosya, bu haftaki duruşma,
 * bekleyen süre, ayın net finansı). Elimde karşılığı olmayan bir kalemi
 * "tasarıma benzesin" diye uydurmuyoruz.
 *
 * KLAVYE (j/k gez · enter aç) HENÜZ YOK — alt satırdaki ipucu bu yüzden
 * yalnız gerçekten çalışan kısayolu yazıyor. Çalışmayan bir kısayolu ipucu
 * olarak göstermek, kullanıcıyı denemeye çağırıp hayal kırıklığına uğratır.
 */
export function TerminalPano() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const dateLocale = lang === 'tr' ? trLocale : enUS;
  const { width } = useWindowDimensions();
  const genis = genisEkranMi(width);
  const profile = useAuthStore((s) => s.profile);

  const acikDavalar = useCases({ status: 'open' });
  const durusmalar = useAllHearings();
  const sureler = useAllDeadlines();
  const finans = useFinanceEntries();

  const davalar = acikDavalar.data ?? [];

  /** Her dava için sıradaki (gelecek, tamamlanmamış) duruşma. */
  const siradakiDurusma = useMemo(() => {
    const simdi = Date.now();
    const m = new Map<string, { at: string; baslik: string }>();
    (durusmalar.data ?? []).forEach((h) => {
      if (h.is_completed || !h.case_id) return;
      const ts = new Date(h.scheduled_at).getTime();
      if (isNaN(ts) || ts < simdi) return;
      const eski = m.get(h.case_id);
      if (!eski || ts < new Date(eski.at).getTime()) m.set(h.case_id, { at: h.scheduled_at, baslik: h.title });
    });
    return m;
  }, [durusmalar.data]);

  const sayilar = useMemo(() => {
    const simdi = Date.now();
    const haftaSonu = simdi + 7 * 86_400_000;
    const buHaftaDurusma = (durusmalar.data ?? []).filter((h) => {
      if (h.is_completed) return false;
      const z = new Date(h.scheduled_at).getTime();
      return z >= simdi && z <= haftaSonu;
    }).length;
    const bekleyenSure = (sureler.data ?? []).filter(
      (d) => !d.is_completed && new Date(d.due_at).getTime() >= simdi,
    ).length;
    // GECİKMİŞ: süresi geçmiş ve hâlâ tamamlanmamış görevler. Maketteki
    // "gecikmiş ₺8.500" para kalemiydi; bizde karşılığı olan gerçek kalem bu.
    const gecikmis = (sureler.data ?? []).filter(
      (d) => !d.is_completed && new Date(d.due_at).getTime() < simdi,
    ).length;
    return {
      dosya: acikDavalar.isPending ? null : davalar.length,
      durusma: durusmalar.data ? buHaftaDurusma : null,
      sure: sureler.data ? bekleyenSure : null,
      gecikmis: sureler.data ? gecikmis : null,
    };
  }, [davalar.length, acikDavalar.isPending, durusmalar.data, sureler.data]);

  /** Bu ayın net finansı — var olan finans ekranıyla aynı hesap. */
  const ayNet = useMemo(() => {
    const simdi = new Date();
    let gelir = 0;
    let gider = 0;
    (finans.data ?? []).forEach((e) => {
      const d = new Date(e.entry_date);
      if (isNaN(d.getTime())) return;
      if (d.getFullYear() !== simdi.getFullYear() || d.getMonth() !== simdi.getMonth()) return;
      const tutar = Number(e.amount) || 0;
      if (e.kind === 'income') gelir += tutar;
      else gider += tutar;
    });
    return finans.data ? gelir - gider : null;
  }, [finans.data]);

  const yaklasan = useMemo(() => {
    return (sureler.data ?? [])
      .filter((d) => !d.is_completed)
      .sort((a, b) => a.due_at.localeCompare(b.due_at))
      .slice(0, 6);
  }, [sureler.data]);

  const bugun = useMemo(() => {
    const anahtar = format(new Date(), 'yyyy-MM-dd');
    const k = (iso: string) => {
      const d = new Date(iso);
      return isNaN(d.getTime()) ? '' : format(d, 'yyyy-MM-dd');
    };
    const h = (durusmalar.data ?? [])
      .filter((x) => !x.is_completed && k(x.scheduled_at) === anahtar)
      .map((x) => ({ id: 'h' + x.id, at: x.scheduled_at, baslik: x.title, yol: `/(app)/calendar` }));
    const d = (sureler.data ?? [])
      .filter((x) => !x.is_completed && k(x.due_at) === anahtar)
      .map((x) => ({ id: 'd' + x.id, at: x.due_at, baslik: x.title, yol: `/(app)/calendar` }));
    return [...h, ...d].sort((a, b) => a.at.localeCompare(b.at));
  }, [durusmalar.data, sureler.data]);

  const yenile = () => {
    acikDavalar.refetch();
    durusmalar.refetch();
    sureler.refetch();
    finans.refetch();
  };
  const yenileniyor =
    acikDavalar.isRefetching || durusmalar.isRefetching || sureler.isRefetching || finans.isRefetching;

  const gunFarki = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);

  /** Kalan güne göre renk: geçmiş kırmızı, bir hafta içi kehribar, ötesi sakin. */
  const gunRengi = (gun: number) =>
    gun < 0 ? colors.danger : gun <= 7 ? colors.warning : colors.textSecondary;

  const gunYazi = (gun: number) => (lang === 'tr' ? `${gun}g` : `${gun}d`);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.govde}
        refreshControl={<RefreshControl refreshing={yenileniyor} onRefresh={yenile} tintColor={colors.primary} />}
      >
        <UstCubuk />

        {/* ── Başlık satırı ─────────────────────────────────────────────── */}
        <Text style={styles.ekranBasligi}>
          {t('term.panoBaslik')}
          {' · '}
          {format(new Date(), 'd MMMM yyyy', { locale: dateLocale }).toLocaleUpperCase(lang === 'tr' ? 'tr-TR' : 'en-US')}
          {profile?.full_name ? ` · ${profile.full_name}` : ''}
        </Text>

        {/* ── Rakam şeridi ──────────────────────────────────────────────── */}
        <View style={styles.rakamSerit}>
          <Rakam etiket={t('term.acik')} deger={sayilar.dosya} styles={styles} colors={colors} />
          <Rakam etiket={t('term.durusma')} deger={sayilar.durusma} styles={styles} colors={colors} />
          <Rakam etiket={t('term.sure')} deger={sayilar.sure} styles={styles} colors={colors} />
          <Rakam
            etiket={t('term.gecikmis')}
            deger={sayilar.gecikmis}
            renk={sayilar.gecikmis ? colors.danger : undefined}
            styles={styles}
            colors={colors}
          />
          <Rakam
            etiket={t('term.ayNet')}
            metin={ayNet == null ? null : formatMoney(ayNet)}
            renk={ayNet != null && ayNet < 0 ? colors.danger : colors.success}
            styles={styles}
            colors={colors}
          />
        </View>

        {/* ── BUGÜN ─────────────────────────────────────────────────────── */}
        <Text style={styles.bolumBasligi}>
          {t('term.bugun')}
          {' · '}
          {t('term.kayitSayisi', { n: bugun.length })}
        </Text>
        {bugun.length === 0 ? (
          <Text style={styles.bos}>{t('term.bugunBos')}</Text>
        ) : (
          bugun.map((s) => (
            <Pressable
              key={s.id}
              style={styles.satir}
              onPress={() => router.push(s.yol as Parameters<typeof router.push>[0])}
            >
              <Text style={[styles.hucre, styles.saat]}>{format(new Date(s.at), 'HH:mm')}</Text>
              <Text style={[styles.hucre, styles.esnek]} numberOfLines={1}>
                {s.baslik}
              </Text>
            </Pressable>
          ))
        )}

        {/* ── YAKLAŞAN SÜRELER ──────────────────────────────────────────── */}
        <Text style={styles.bolumBasligi}>
          {t('term.sureler')}
          {' · '}
          {t('term.kayitSayisi', { n: yaklasan.length })}
        </Text>
        {yaklasan.length === 0 ? (
          <Text style={styles.bos}>{t('term.sureBos')}</Text>
        ) : (
          <>
            <View style={styles.baslikSatiri}>
              <Text style={[styles.basHucre, styles.tarihSut]}>{t('term.sutunTarih')}</Text>
              <Text style={[styles.basHucre, styles.esnek]}>{t('term.sutunGorev')}</Text>
              {genis && <Text style={[styles.basHucre, styles.dosyaSut]}>{t('term.sutunDosya')}</Text>}
              <Text style={[styles.basHucre, styles.gunSut, styles.sag]}>{t('term.sutunGun')}</Text>
            </View>
            {yaklasan.map((d) => {
              const gun = gunFarki(d.due_at);
              return (
                <Pressable key={d.id} style={styles.satir} onPress={() => router.push('/(app)/calendar')}>
                  <Text style={[styles.hucre, styles.tarihSut, styles.sessiz]}>
                    {format(new Date(d.due_at), 'd MMM', { locale: dateLocale })}
                  </Text>
                  <Text style={[styles.hucre, styles.esnek]} numberOfLines={2}>
                    {d.title}
                  </Text>
                  {genis && (
                    <Text style={[styles.hucre, styles.dosyaSut, styles.sessiz]} numberOfLines={1}>
                      {d.case?.title ?? '—'}
                    </Text>
                  )}
                  <Text style={[styles.hucre, styles.gunSut, styles.sag, styles.kalin, { color: gunRengi(gun) }]}>
                    {gunYazi(gun)}
                  </Text>
                </Pressable>
              );
            })}
          </>
        )}

        {/* ── DOSYA KÜTÜĞÜ ──────────────────────────────────────────────── */}
        <Text style={styles.bolumBasligi}>
          {t('term.kutuk')}
          {' · '}
          {t('term.kayitSayisi', { n: davalar.length })}
          {' · '}
          {t('term.filtreAcik')}
        </Text>
        {davalar.length === 0 ? (
          <Text style={styles.bos}>{t('term.dosyaBos')}</Text>
        ) : (
          <>
            <View style={styles.baslikSatiri}>
              <Text style={[styles.basHucre, styles.esasSut]}>{t('term.sutunEsas')}</Text>
              <Text style={[styles.basHucre, styles.esnek]}>{t('term.sutunDosya')}</Text>
              {genis && <Text style={[styles.basHucre, styles.mahkemeSut]}>{t('term.sutunMahkeme')}</Text>}
              {genis && <Text style={[styles.basHucre, styles.siradakiSut]}>{t('term.sutunSiradaki')}</Text>}
              <Text style={[styles.basHucre, styles.gunSut, styles.sag]}>{t('term.sutunGun')}</Text>
            </View>
            {davalar.map((d) => {
              const sira = siradakiDurusma.get(d.id);
              const gun = sira ? gunFarki(sira.at) : null;
              return (
                <Pressable
                  key={d.id}
                  style={styles.satir}
                  onPress={() => router.push(`/(app)/cases/${d.id}` as Parameters<typeof router.push>[0])}
                >
                  <Text style={[styles.hucre, styles.esasSut, { color: colors.info }]} numberOfLines={1}>
                    {d.case_number ?? '—'}
                  </Text>
                  <Text style={[styles.hucre, styles.esnek]} numberOfLines={2}>
                    {d.title}
                  </Text>
                  {genis && (
                    <Text style={[styles.hucre, styles.mahkemeSut, styles.sessiz]} numberOfLines={2}>
                      {d.court_name ?? '—'}
                    </Text>
                  )}
                  {genis && (
                    <Text style={[styles.hucre, styles.siradakiSut, styles.sessiz]} numberOfLines={2}>
                      {sira?.baslik ?? '—'}
                    </Text>
                  )}
                  <Text
                    style={[
                      styles.hucre,
                      styles.gunSut,
                      styles.sag,
                      styles.kalin,
                      { color: gun == null ? colors.textMuted : gunRengi(gun) },
                    ]}
                  >
                    {gun == null ? '—' : gunYazi(gun)}
                  </Text>
                </Pressable>
              );
            })}
          </>
        )}

        {/* KISAYOL İPUCU — YALNIZ GERÇEKTEN ÇALIŞANLAR YAZILIR.
            Makette "j/k gez · enter aç · t süre ekle" da vardı; onlar henüz
            yok. Olmayan kısayolu ipucu diye yazmak kullanıcıyı denemeye
            çağırıp hiçbir şey olmamasıyla karşılaştırır. */}
        <Text style={styles.ipucu}>{t('term.ipucu')}</Text>
      </ScrollView>
    </Screen>
  );
}

function Rakam({
  etiket,
  deger,
  metin,
  renk,
  styles,
  colors,
}: {
  etiket: string;
  deger?: number | null;
  metin?: string | null;
  renk?: string;
  styles: ReturnType<typeof makeStyles>;
  colors: ThemeColors;
}) {
  // Veri henüz gelmediyse "0" YAZMA. Sıfır bir ölçümdür ("hiç yok"); yükleniyor
  // değildir. İkisini aynı göstermek, boş bir hesabı dolu bir hesap gibi
  // gösterebilir ya da tersi.
  const yukleniyor = metin === undefined ? deger == null : metin == null;
  return (
    <View style={styles.rakam}>
      <Text style={styles.rakamEtiket}>{etiket}</Text>
      <Text style={[styles.rakamDeger, { color: renk ?? colors.textPrimary }]}>
        {yukleniyor ? '·' : (metin ?? String(deger))}
      </Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    govde: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xxl,
    },
    ekranBasligi: {
      ...typography.small,
      color: colors.textMuted,
      marginBottom: spacing.xs,
    },
    rakamSerit: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingBottom: spacing.xs,
      marginBottom: spacing.sm,
    },
    rakam: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 5,
    },
    rakamEtiket: {
      ...typography.caption,
      color: colors.textMuted,
    },
    rakamDeger: {
      ...typography.bodyMedium,
      fontWeight: '700',
    },
    bolumBasligi: {
      ...typography.small,
      color: colors.textMuted,
      marginTop: spacing.md,
      marginBottom: spacing.xs,
    },
    baslikSatiri: {
      flexDirection: 'row',
      gap: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingBottom: 4,
    },
    basHucre: {
      ...typography.caption,
      color: colors.textMuted,
    },
    satir: {
      flexDirection: 'row',
      gap: spacing.xs,
      alignItems: 'flex-start',
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSubtle,
      paddingVertical: 6,
    },
    hucre: {
      ...typography.body,
      color: colors.textPrimary,
    },
    sessiz: {
      color: colors.textSecondary,
    },
    kalin: {
      fontWeight: '700',
    },
    esnek: {
      flex: 1,
      minWidth: 0,
    },
    sag: {
      textAlign: 'right',
    },
    saat: { width: 46 },
    tarihSut: { width: 62 },
    esasSut: { width: 86 },
    mahkemeSut: { width: 128 },
    siradakiSut: { width: 128 },
    dosyaSut: { width: 140 },
    gunSut: { width: 40 },
    bos: {
      ...typography.body,
      color: colors.textMuted,
      paddingVertical: spacing.xs,
    },
    ipucu: {
      ...typography.caption,
      color: colors.textMuted,
      marginTop: spacing.lg,
    },
  });
