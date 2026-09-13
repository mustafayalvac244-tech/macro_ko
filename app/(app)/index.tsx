import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns/format';
import { isToday } from 'date-fns/isToday';
import { isTomorrow } from 'date-fns/isTomorrow';
import { tr as trLocale } from 'date-fns/locale/tr';
import { enUS } from 'date-fns/locale/en-US';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui/Avatar';
import { TemaDugmesi } from '@/components/ui/TemaDugmesi';
import { useAuthStore } from '@/store/authStore';
import { useSidebarStore } from '@/store/sidebarStore';
import { useAvatarUrl } from '@/hooks/useAvatarUrl';
import { useCases } from '@/hooks/useCases';
import { useCasePrecedents, caseCourt, caseSearchTerm } from '@/hooks/useCasePrecedents';
import { useAllHearings } from '@/hooks/useHearings';
import { useMorningDigest } from '@/hooks/useMorningDigest';
import { useReminderSync } from '@/hooks/useReminderSync';
import { useAllDeadlines } from '@/hooks/useDeadlines';
import { useFinanceEntries } from '@/hooks/useFinance';
import { useAdvanceDeficits } from '@/hooks/useClientAdvances';
import { useAdvanceAlertStore } from '@/store/advanceAlertStore';
import { AI_ENABLED } from '@/config/features';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import { pendingOutcomeHearings } from '@/utils/hearingOutcome';
import { useLangStore, useT } from '@/i18n';
import { fonts, spacing, shadow } from '@/theme/theme';
import { kaliciMenuMu, ortalaStili, panoOlculeri, PANO_ARALIK, PANO_YAN_BOSLUK } from '@/theme/duzen';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { formatMoney, formatTime } from '@/utils/format';

/**
 * Premium ana ekran — başlıklar zarif serifle (Playfair Display), etiketler
 * Manrope ile çizilir. Renkler seçili tema paketinden gelir; "Güne Başla"
 * butonu ve çanta karosu altın gradyanla dolgun bir görünüm alır.
 */
const SERIF = 'PlayfairDisplay_700Bold';

/** Zengin, metalik altın — açık temaların koyu/kahverengi altını yerine kullanılır. */
const RICH_GOLD = '#D4AF37';

/** Sıcak, açık altın — dolgu (saat bloğu, "Güne Başla", seçili çip) için. Mat
 * hardal yerine premium bir ton; üzerine koyu lacivert yazı okunur. */
const SLEEK_GOLD = '#ECC24C';
const ON_SLEEK_GOLD = '#17233F';

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

/**
 * Vurgu altını: tema altını yeterince parlaksa (koyu temalar) onu kullan; koyu/
 * mat (açık temalar) ise zengin metalik altına geç — "Güne Başla" ve çanta her
 * temada gerçek altın görünsün, kahverengi durmasın.
 */
function accentGoldFor(themeGold: string): string {
  return luminance(themeGold) < 0.6 ? RICH_GOLD : themeGold;
}

/** Altın zemin üzerindeki yazı/ikon rengi: parlak altında koyu lacivert, koyu altında beyaz. */
function onGoldColor(hex: string): string {
  return luminance(hex) > 0.6 ? '#14213D' : '#FFFFFF';
}

export default function DashboardScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();
  const { width: pencereGenisligi } = useWindowDimensions();
  const accentGold = accentGoldFor(colors.gold);

  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const dateLocale = lang === 'tr' ? trLocale : enUS;
  const profile = useAuthStore((s) => s.profile);
  const trial = useTrialStatus();
  const avatarUrl = useAvatarUrl();
  const openSidebar = useSidebarStore((s) => s.open);
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  // PANO IZGARASI — yalnız geniş tarayıcıda devreye girer.
  // Telefonda ve natifte `sutun` 1 döner ve her blok tam genişlik alır, yani
  // bugünkü tek sütunlu düzenin birebir aynısı. Ölçüler tek yerden geliyor ve
  // sınanıyor (src/theme/duzen.ts → panoOlculeri, tests/panoIzgara.test.ts).
  const kaliciMenu = kaliciMenuMu(pencereGenisligi);
  const pano = panoOlculeri(pencereGenisligi, kaliciMenu);
  const panoMu = pano.sutun > 1;
  /** Bloklara genişlik veren kısa yardımcı; tek sütunda hiçbir şey eklemez. */
  const blok = useCallback(
    (tur: 'tam' | 'yarim' | 'ucteBir' | 'ikiUcte') => (panoMu ? { width: pano[tur] } : null),
    [panoMu, pano],
  );

  const hearings = useAllHearings();
  const deadlines = useAllDeadlines();
  const finance = useFinanceEntries();
  useMorningDigest();
  // Hatırlatmaları sunucudaki kayıtlardan yeniden kurar: yeniden kurulum,
  // cihaz değişikliği ve sonradan verilen bildirim izni sonrası sessiz kayıp
  // buradan onarılır (bkz. useReminderSync).
  useReminderSync();

  // Duruşma Çıkışı: sonucu girilmemiş (geçmiş, tamamlanmamış) duruşmalar.
  // Bunlar kaydedilmezse duruşmada verilen süreler kayboluyor — süre kaçırmanın
  // ana sebebi buydu, o yüzden ana ekranda proaktif hatırlatıyoruz.
  const pendingOutcomes = useMemo(
    () => pendingOutcomeHearings(hearings.data ?? []),
    [hearings.data]
  );

  // Davana Emsal: aktif davalar + seçili davanın konusuna göre Yargıtay emsalleri.
  const openCases = useCases({ status: 'open' });
  const caseList = openCases.data ?? [];
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const selectedCase = useMemo(
    () => caseList.find((c) => c.id === selectedCaseId) ?? caseList[0] ?? null,
    [caseList, selectedCaseId]
  );
  const precTerm = caseSearchTerm(selectedCase);
  // İdari dosyada Danıştay, diğerlerinde Yargıtay sorulur.
  const precedents = useCasePrecedents(precTerm, caseCourt(selectedCase));

  // Masraf avansı eksiye düşen müvekkiller (kapatılanlar hariç) — ana ekran uyarısı.
  const advanceDeficits = useAdvanceDeficits();
  const dismissedAlerts = useAdvanceAlertStore((s) => s.dismissed);
  const dismissAlert = useAdvanceAlertStore((s) => s.dismiss);
  const advanceAlerts = useMemo(
    () => (advanceDeficits.data ?? []).filter((d) => !dismissedAlerts.includes(d.id)),
    [advanceDeficits.data, dismissedAlerts]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries();
    setRefreshing(false);
  }, [queryClient]);

  const now = new Date();
  const hour = now.getHours();
  const greetingKey = hour < 12 ? 'dash.goodMorning' : hour < 18 ? 'dash.goodAfternoon' : 'dash.goodEvening';
  // Kullanıcı adının başına "Av." yazmış olabilir; tekrar "Av." eklemeyelim.
  const cleanName = (profile?.full_name ?? '').trim().replace(/^av\.?\s+/i, '');
  const firstName = cleanName ? `Av. ${cleanName.split(' ')[0]}` : t('dash.counselor');

  // "Bugün · 10:30" / "Yarın · 18:00" / "13 Tem · 09:00"
  const whenLabel = useCallback(
    (iso: string) => {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      const day = isToday(d) ? t('fmt.today') : isTomorrow(d) ? t('fmt.tomorrow') : format(d, 'd MMM', { locale: dateLocale });
      return `${day} · ${formatTime(iso)}`;
    },
    [t, dateLocale]
  );

  // Bugün planlı işlem sayısı (duruşma + görev) — asistan satırında gösterilir.
  const todayCount = useMemo(() => {
    const todayKey = format(new Date(), 'yyyy-MM-dd');
    const toKey = (iso: string) => {
      const d = new Date(iso);
      return isNaN(d.getTime()) ? '' : format(d, 'yyyy-MM-dd');
    };
    const h = (hearings.data ?? []).filter((x) => !x.is_completed && toKey(x.scheduled_at) === todayKey).length;
    const d = (deadlines.data ?? []).filter((x) => !x.is_completed && toKey(x.due_at) === todayKey).length;
    return h + d;
  }, [hearings.data, deadlines.data]);

  const nextHearing = useMemo(() => {
    // Alıcı geri bildirimi: Arabuluculuk/toplantı türü kayıtlar "Sonraki duruşma"
    // olarak gösterilmemeli — sadece gerçek duruşmalar (duruşma/celse) sayılır.
    const hearingTypes = ['hearing', 'trial', 'deposition'];
    return (hearings.data ?? [])
      .filter((h) => {
        const d = new Date(h.scheduled_at);
        return (
          !h.is_completed &&
          hearingTypes.includes(h.type) &&
          !isNaN(d.getTime()) &&
          d.getTime() >= now.getTime() - 60 * 60 * 1000
        );
      })
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hearings.data]);

  const nextDeadline = useMemo(() => {
    return (deadlines.data ?? [])
      .filter((d) => !d.is_completed && !isNaN(new Date(d.due_at).getTime()))
      .sort((a, b) => a.due_at.localeCompare(b.due_at))[0];
  }, [deadlines.data]);

  // "SIRADAKI": en yakın gelecekteki ajanda kaydı (TÜR fark etmez — duruşma da
  // toplantı da). Burak geri bildirimi gereği tür kendi adıyla gösterilir.
  const nextEvent = useMemo(() => {
    return (hearings.data ?? [])
      .filter((h) => {
        const d = new Date(h.scheduled_at);
        return !h.is_completed && !isNaN(d.getTime()) && d.getTime() >= now.getTime() - 60 * 60 * 1000;
      })
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hearings.data]);

  // "BUGÜN": bugünkü duruşma/toplantı + görevler, saate göre sıralı.
  const todayItems = useMemo(() => {
    const key = format(new Date(), 'yyyy-MM-dd');
    const k = (iso: string) => {
      const d = new Date(iso);
      return isNaN(d.getTime()) ? '' : format(d, 'yyyy-MM-dd');
    };
    const hs = (hearings.data ?? [])
      .filter((h) => !h.is_completed && k(h.scheduled_at) === key)
      .map((h) => ({ id: 'h' + h.id, at: h.scheduled_at, title: h.title, isEvent: true }));
    const ds = (deadlines.data ?? [])
      .filter((d) => !d.is_completed && k(d.due_at) === key)
      .map((d) => ({ id: 'd' + d.id, at: d.due_at, title: d.title, isEvent: false }));
    return [...hs, ...ds].sort((a, b) => a.at.localeCompare(b.at));
  }, [hearings.data, deadlines.data]);

  // Focus case: the case behind the most pressing deadline, else next hearing's case.
  // ZAMAN-DUYARLI: yakın olmayan (haftalar sonraki) bir duruşmayı "acil/yüksek
  // öncelik" gibi göstermeyip sakin bir sayaçla ("N gün kaldı") sunar — boşuna
  // telaşlandırmaz (Burak geri bildirimi).
  const focus = useMemo(() => {
    const daysLeft = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
    if (nextDeadline?.case) {
      const days = daysLeft(nextDeadline.due_at);
      return {
        caseId: nextDeadline.case_id,
        label: `${nextDeadline.case.case_number ? nextDeadline.case.case_number + ' – ' : ''}${nextDeadline.case.title}`,
        hearingWhen: nextHearing && nextHearing.case_id === nextDeadline.case_id ? whenLabel(nextHearing.scheduled_at) : null,
        days,
        // GECİKMİŞ SÜRE AYRI SÖYLENİR.
        //
        // nextDeadline, nextHearing/nextEvent'ten farklı olarak GEÇMİŞ kayıtları
        // ELEMİYOR (bilinçli: tamamlanmamış, süresi geçmiş bir iş bir hukuk
        // uygulamasında en acil şeydir; gizlemek yanlış olurdu). Ama pano onu
        // yaklaşan bir süreyle AYNI cümleyle gösteriyordu — avukat, aylar önce
        // geçmiş bir süreyi "bekleyen görev" diye okuyordu. Gecikme artık
        // açıkça yazılıyor; kayıt hâlâ görünür kalıyor.
        reason:
          days < 0
            ? t('dash.focus.reasonOverdue', { title: nextDeadline.title, n: Math.abs(days) })
            : days <= 7
              ? t('dash.focus.reasonDue', { title: nextDeadline.title })
              : t('dash.focus.reasonDueFar', { title: nextDeadline.title, n: days }),
      };
    }
    if (nextHearing?.case) {
      const days = daysLeft(nextHearing.scheduled_at);
      return {
        caseId: nextHearing.case_id,
        label: `${nextHearing.case.case_number ? nextHearing.case.case_number + ' – ' : ''}${nextHearing.case.title}`,
        hearingWhen: whenLabel(nextHearing.scheduled_at),
        days,
        reason: days <= 7 ? t('dash.focus.reasonHearing') : t('dash.focus.reasonHearingFar', { n: days }),
      };
    }
    return null;
  }, [nextDeadline, nextHearing, whenLabel, t]);

  // Suggested step heuristic
  const suggestion = useMemo(() => {
    if (nextDeadline) return { value: t('dash.assist.sugDeadline'), right: nextDeadline.title };
    if (nextHearing) return { value: t('dash.assist.sugHearing'), right: nextHearing.case?.title ?? nextHearing.title };
    return { value: t('dash.assist.sugCalendar'), right: t('tab.calendar') };
  }, [nextDeadline, nextHearing, t]);

  /**
   * ÜST ŞERİTTEKİ DÖRT SAYI — yalnız panoda görünür.
   *
   * NEDEN VAR. Pano açıldığında ilk sorulan şey "bugün ne var" değil, "durum
   * ne": kaç dosyam açık, bu hafta kaç duruşmam var, kaç süre yaklaşıyor.
   * Bu sayılar zaten yüklenen veriden hesaplanıyor; ek istek YOK.
   *
   * SAYILAR VERİ GELMEDEN 0 GÖSTERMEZ. Yükleme sırasında 0 basmak, "hiç
   * dosyan yok" demekle aynı şey — avukat bir an için verisini kaybettiğini
   * sanır. Veri yoksa çizgi (—) gösteriliyor.
   */
  const panoSayilari = useMemo(() => {
    const haftaSonu = Date.now() + 7 * 86_400_000;
    const buHafta = (hearings.data ?? []).filter((h) => {
      if (h.is_completed) return false;
      const z = new Date(h.scheduled_at).getTime();
      return z >= Date.now() && z <= haftaSonu;
    }).length;
    const bekleyenSure = (deadlines.data ?? []).filter(
      (d) => !d.is_completed && new Date(d.due_at).getTime() >= Date.now(),
    ).length;
    return {
      dosya: openCases.isPending ? null : caseList.length,
      durusma: hearings.data ? buHafta : null,
      sure: deadlines.data ? bekleyenSure : null,
      sonuc: hearings.data ? pendingOutcomes.length : null,
    };
  }, [caseList.length, openCases.isPending, hearings.data, deadlines.data, pendingOutcomes.length]);

  /**
   * YAKLAŞAN SÜRELER — panonun sağ sütunundaki liste.
   *
   * Ana ekranda süreler yalnız "bugün" kutusunda ve tek bir "sıradaki" satırı
   * olarak görünüyordu; yarından sonrası hiç görünmüyordu. Süre kaçırmanın en
   * yaygın sebebi tam olarak bu: bugüne bakmak, haftaya bakmamak.
   */
  const yaklasanSureler = useMemo(() => {
    return (deadlines.data ?? [])
      .filter((d) => !d.is_completed && new Date(d.due_at).getTime() >= Date.now() - 86_400_000)
      .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime())
      .slice(0, 6)
      .map((d) => ({
        id: d.id,
        baslik: d.title,
        dosya: d.case?.title ?? '',
        tarih: format(new Date(d.due_at), 'd MMM yyyy', { locale: dateLocale }),
        kalanGun: Math.ceil((new Date(d.due_at).getTime() - Date.now()) / 86_400_000),
      }));
  }, [deadlines.data, dateLocale]);

  // Finance summary: this month vs last month (+ net cash flow)
  const fin = useMemo(() => {
    const entries = finance.data ?? [];
    const y = now.getFullYear();
    const m = now.getMonth();
    const inMonth = (dateStr: string, year: number, month: number) => {
      const d = new Date(dateStr);
      return !isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === month;
    };
    const prevY = m === 0 ? y - 1 : y;
    const prevM = m === 0 ? 11 : m - 1;
    let income = 0;
    let expense = 0;
    let prevIncome = 0;
    let prevExpense = 0;
    const incomeSeries: number[] = new Array(8).fill(0);
    const expenseSeries: number[] = new Array(8).fill(0);
    entries.forEach((e) => {
      const amount = Number(e.amount) || 0;
      if (inMonth(e.entry_date, y, m)) {
        const day = new Date(e.entry_date).getDate();
        const bucket = Math.min(7, Math.floor((day - 1) / 4));
        if (e.kind === 'income') {
          income += amount;
          incomeSeries[bucket] = (incomeSeries[bucket] ?? 0) + amount;
        } else {
          expense += amount;
          expenseSeries[bucket] = (expenseSeries[bucket] ?? 0) + amount;
        }
      } else if (inMonth(e.entry_date, prevY, prevM)) {
        if (e.kind === 'income') prevIncome += amount;
        else prevExpense += amount;
      }
    });
    const pct = (cur: number, prev: number) => (prev !== 0 ? Math.round(((cur - prev) / Math.abs(prev)) * 100) : null);
    const netSeries = incomeSeries.map((v, i) => Math.max(0, v - (expenseSeries[i] ?? 0)));
    return {
      income,
      expense,
      net: income - expense,
      incomePct: pct(income, prevIncome),
      expensePct: pct(expense, prevExpense),
      netPct: pct(income - expense, prevIncome - prevExpense),
      incomeSeries,
      expenseSeries,
      netSeries,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finance.data]);

  return (
    <View style={styles.root}>
      <StatusBar style={__t.statusBar} />
      <ScrollView
        // Geniş ekranda (web) içerik ortalanır; telefonda ortalaStili null döner
        // ve dizideki null öge yok sayılır — natif düzen aynen korunur.
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xs, paddingBottom: (kaliciMenu ? 32 : 96) + insets.bottom },
          // PANODA IZGARA, DAR EKRANDA YIĞIN.
          // `alignItems: 'flex-start'` şart: olmazsa aynı satırdaki kartlar en
          // uzunun boyuna esner ve kısa kartın içi kocaman bir boşluk olur.
          // `rowGap`/`columnGap` ayrı veriliyor çünkü kartların kendi
          // `marginBottom`u tek sütun düzeni için duruyor; panoda o marjı
          // sıfırlayıp boşluğu ızgara yönetiyor.
          panoMu
            ? {
                flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start',
                columnGap: PANO_ARALIK, rowGap: PANO_ARALIK,
                // Dolgu, blok genişliklerini hesaplayan sabitle AYNI olmak
                // zorunda (bkz. duzen.ts → PANO_YAN_BOSLUK). Ayrıştığında son
                // blok alt satıra düşüyor ve pano yine yarım kalıyor.
                paddingHorizontal: PANO_YAN_BOSLUK,
              }
            : null,
          ortalaStili(pencereGenisligi, panoMu ? 'pano' : 'genis'),
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl tintColor={colors.textSecondary} refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* ---------- Üst çubuk ---------- */}
        <View style={[styles.toolbar, blok('tam')]}>
          <View style={styles.toolbarLeft}>
            {/* Menü zaten solda sürekli duruyorsa hamburger gereksiz —
                aynı menüye iki giriş kullanıcıyı şaşırtır. */}
            {!kaliciMenuMu(pencereGenisligi) && (
              <Pressable onPress={openSidebar} hitSlop={10}>
                <Ionicons name="menu" size={24} color={colors.textPrimary} />
              </Pressable>
            )}
            <View style={styles.brandRow}>
              <MaterialCommunityIcons name="scale-balance" size={22} color={colors.primary} />
              <Text allowFontScaling={false} style={styles.brandText}>
                Vekil<Text style={styles.brandTextPro}> Pro</Text>
              </Text>
            </View>
          </View>
          <View style={styles.toolbarRight}>
            {/* HIZLI TEMA DÜĞMESİ — koyu ↔ beyaz. Yalnız web'de görünür
                (bkz. TemaDugmesi: telefonda üst çubukta yer yok, tam seçim
                Ayarlar'da). Zilin SOLUNDA duruyor: bildirim ve hesap,
                kullanıcının en sağda aradığı iki şey; görünüm tercihi
                onların önüne geçmemeli. */}
            <TemaDugmesi />
            <Pressable
              onPress={() => router.push('/reminders' as Parameters<typeof router.push>[0])}
              hitSlop={8}
              style={styles.bellButton}
            >
              <Ionicons name="notifications-outline" size={20} color={colors.textPrimary} />
            </Pressable>
            <Pressable onPress={() => router.push('/settings')}>
              <Avatar name={profile?.full_name || t('dash.counselor')} size={34} uri={avatarUrl} premium={profile?.is_premium} />
            </Pressable>
          </View>
        </View>

        {/* ---------- Karşılama (+ panoda durum sayıları) ----------
             Sayılar YALNIZ panoda çıkıyor. Telefonda aynı satıra dört sayı
             sığmaz; sığdırmaya çalışmak, bugünkü sade karşılamayı bozar ve
             ekranın üstünden yer çalar. Geniş tarayıcıda ise sağ taraf zaten
             boştu — sayılar tam oraya oturuyor. */}
        <View style={[styles.panoBaslikSatiri, blok('tam')]}>
          <View>
            <Text allowFontScaling={false} style={styles.greeting}>
              {t(greetingKey)}, {firstName}
            </Text>
            <Text allowFontScaling={false} style={styles.greetingSub}>{t('dash.subline')}</Text>
          </View>
          {panoMu && (
            <View style={styles.panoSayilar}>
              <PanoSayi etiket={t('dash.stat.cases')} deger={panoSayilari.dosya} />
              <PanoSayi etiket={t('dash.stat.hearings')} deger={panoSayilari.durusma} />
              <PanoSayi etiket={t('dash.stat.deadlines')} deger={panoSayilari.sure} />
              <PanoSayi etiket={t('dash.stat.outcomes')} deger={panoSayilari.sonuc} />
            </View>
          )}
        </View>

        {/* ---------- Plan durumu ----------
            Eskiden burada 7 günlük deneme sayacı ve "deneme süren doldu"
            kartı vardı; ikisi de gerçeğe uymuyordu (bkz. useTrialStatus).
            Ücretsiz katman kalıcı olduğu için geri sayım yerine sabit ve
            baskısız tek satır: kullanıcı hangi plandaysa onu söyler. */}
        {!trial.subscribed && (
          <Pressable
            style={({ pressed }) => [styles.trialPill, blok('tam'), pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/premium' as Parameters<typeof router.push>[0])}
          >
            <Ionicons name="sparkles-outline" size={15} color={colors.primary} />
            <Text allowFontScaling={false} style={styles.trialPillText}>{t('plan.freePill')}</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </Pressable>
        )}

        {/* ---------- Duruşma Çıkışı bekleyenler ---------- */}
        {pendingOutcomes.length > 0 && (
          <Pressable
            style={({ pressed }) => [styles.outcomeCard, blok('tam'), panoMu && styles.panoMarjsiz, pressed && { opacity: 0.9 }]}
            onPress={() => router.push('/durusma-cikisi' as Parameters<typeof router.push>[0])}
          >
            <View style={styles.outcomeIcon}>
              <Ionicons name="checkmark-done" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              {/* TEK BİR DURUŞMA ADIYLA SORULUYOR. Eskiden yalnız sayı yazıyordu
                  ("22 duruşmanın sonucu bekliyor") ve canlı veride 23 geçmiş
                  duruşmanın 22'si işaretsiz kalmıştı. Yirmi iki iş bir hatırlatma
                  değil, bir yığındır; yığın ertelenir. Somut tek bir iş
                  ("3. Asliye — dün") yapılabilir görünür. Kalanların sayısı
                  ikinci satırda duruyor, bilgi kaybolmuyor. */}
              <Text allowFontScaling={false} style={styles.outcomeTitle} numberOfLines={1}>
                {t('dash.outcome.one', {
                  baslik: pendingOutcomes[0].case?.title || pendingOutcomes[0].title,
                  ne_zaman: whenLabel(pendingOutcomes[0].scheduled_at).split(' · ')[0],
                })}
              </Text>
              <Text allowFontScaling={false} style={styles.outcomeDesc}>
                {pendingOutcomes.length > 1
                  ? t('dash.outcome.descMore', { n: pendingOutcomes.length - 1 })
                  : t('dash.outcome.desc')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.primary} />
          </Pressable>
        )}

        {/* ---------- Masraf avansı uyarısı (kapatılabilir) ---------- */}
        {advanceAlerts.length > 0 && (
          <View style={[styles.advanceAlert, blok('tam'), panoMu && styles.panoMarjsiz]}>
            <View style={styles.advanceAlertHead}>
              <Ionicons name="alert-circle" size={16} color={colors.danger} />
              <Text allowFontScaling={false} style={styles.advanceAlertTitle}>{t('dash.advance.title')}</Text>
            </View>
            {advanceAlerts.slice(0, 4).map((d) => (
              <View key={d.id} style={styles.advanceAlertRow}>
                <Pressable style={styles.advanceAlertInfo} onPress={() => router.push(`/(app)/clients/${d.id}`)}>
                  <Text allowFontScaling={false} style={styles.advanceAlertName} numberOfLines={1}>{d.name}</Text>
                  <Text allowFontScaling={false} style={styles.advanceAlertAmount}>
                    {t('dash.advance.need', { amount: formatMoney(d.deficit) })}
                  </Text>
                </Pressable>
                <Pressable onPress={() => dismissAlert(d.id)} hitSlop={8} style={styles.advanceAlertClose}>
                  <Ionicons name="close" size={16} color={colors.textMuted} />
                </Pressable>
              </View>
            ))}
            {advanceAlerts.length > 4 && (
              <Text allowFontScaling={false} style={styles.advanceAlertMore}>
                {t('dash.advance.more', { n: advanceAlerts.length - 4 })}
              </Text>
            )}
          </View>
        )}

        {/* ---------- Sıradaki + Bugün ---------- */}
        <View style={[styles.hero, blok('ikiUcte'), panoMu && styles.panoMarjsiz]}>
          <Text allowFontScaling={false} style={styles.heroTitle}>{t('dash.next.label')}</Text>

          {nextEvent ? (
            <Pressable
              style={({ pressed }) => [styles.nextMain, pressed && { opacity: 0.85 }]}
              onPress={() => router.push('/(app)/calendar')}
            >
              <View style={styles.timeBlock}>
                <Text allowFontScaling={false} style={styles.timeHH}>{formatTime(nextEvent.scheduled_at)}</Text>
                <Text allowFontScaling={false} style={styles.timeDay}>
                  {whenLabel(nextEvent.scheduled_at).split(' · ')[0]}
                </Text>
              </View>
              <View style={styles.nextBody}>
                <Text allowFontScaling={false} style={styles.nextTitle} numberOfLines={1}>{nextEvent.title}</Text>
                <Text allowFontScaling={false} style={styles.nextSub} numberOfLines={1}>
                  {(() => {
                    const typeLabel = String(t(`hearingType.${nextEvent.type}` as never));
                    const ctx = nextEvent.case?.title || nextEvent.location || '';
                    // Başlık zaten tür ise ("Duruşma"), alt satırda tekrar etme.
                    const parts = [typeLabel !== nextEvent.title ? typeLabel : null, ctx].filter(Boolean);
                    return parts.length ? parts.join(' · ') : typeLabel;
                  })()}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          ) : (
            <View style={styles.nextEmpty}>
              <Ionicons name="calendar-clear-outline" size={18} color={colors.textMuted} />
              <Text allowFontScaling={false} style={styles.nextEmptyText}>{t('dash.assist.noHearing')}</Text>
            </View>
          )}

          <Text allowFontScaling={false} style={styles.bugunLabel}>{t('dash.today.label')}</Text>
          {todayItems.length === 0 ? (
            <Text allowFontScaling={false} style={styles.todayEmpty}>{t('dash.noProgramToday')}</Text>
          ) : (
            todayItems.map((it) => (
              <Pressable
                key={it.id}
                style={({ pressed }) => [styles.todayRow, pressed && { opacity: 0.65 }]}
                onPress={() => router.push(it.isEvent ? '/(app)/calendar' : ('/reminders' as Parameters<typeof router.push>[0]))}
              >
                <View style={[styles.todayDot, { backgroundColor: it.isEvent ? colors.primary : colors.textMuted }]} />
                <Text allowFontScaling={false} style={styles.todayTitle} numberOfLines={1}>{it.title}</Text>
                <Text allowFontScaling={false} style={styles.todayTime}>{formatTime(it.at)}</Text>
              </Pressable>
            ))
          )}

          <Pressable
            style={({ pressed }) => [styles.heroCta, { backgroundColor: colors.primary }, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/(app)/calendar')}
          >
            <Text allowFontScaling={false} style={[styles.heroCtaText, { color: colors.textInverse }]}>{t('dash.assist.start')}</Text>
            <Ionicons name="arrow-forward" size={15} color={colors.textInverse} />
          </Pressable>
        </View>

        {/* ---------- Davana Emsal (AI/İçtihat kapalıyken gizli) ---------- */}
        {AI_ENABLED && (
        <View style={[styles.card, blok('ucteBir'), panoMu && styles.panoMarjsiz]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.cardHeaderIcon}>
                <Ionicons name="library-outline" size={15} color={colors.primary} />
              </View>
              <Text allowFontScaling={false} style={styles.cardTitle}>{t('dash.prec.title')}</Text>
            </View>
            <Pressable style={styles.cardHeaderRight} onPress={() => router.push('/ictihat' as Parameters<typeof router.push>[0])} hitSlop={6}>
              <Text allowFontScaling={false} style={styles.cardHeaderLink}>{t('dash.prec.link')}</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
            </Pressable>
          </View>

          {caseList.length === 0 ? (
            <View style={styles.precEmpty}>
              <Ionicons name="library-outline" size={22} color={colors.primary} />
              <Text allowFontScaling={false} style={styles.precEmptyText}>{t('dash.prec.emptyCases')}</Text>
              <Pressable
                style={({ pressed }) => [styles.focusButton, { marginTop: spacing.sm }, pressed && { opacity: 0.8 }]}
                onPress={() => router.push('/case-form' as Parameters<typeof router.push>[0])}
              >
                <Ionicons name="add" size={16} color={colors.primary} />
                <Text allowFontScaling={false} style={styles.focusButtonText}>{t('dash.prec.addCase')}</Text>
              </Pressable>
            </View>
          ) : (
            <View>
              {/* Hangi dava? — birden çok aktif dava varsa seçilebilir çip sırası. */}
              {caseList.length > 1 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.precChipRow}
                >
                  {caseList.slice(0, 12).map((c) => {
                    const active = c.id === selectedCase?.id;
                    const label = (c.case_type?.trim() || c.title || '').trim();
                    return (
                      <Pressable
                        key={c.id}
                        onPress={() => setSelectedCaseId(c.id)}
                        style={[styles.precChip, active && styles.precChipActive]}
                      >
                        <Text
                          allowFontScaling={false}
                          numberOfLines={1}
                          style={[styles.precChipText, active && styles.precChipTextActive]}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}

              <Text allowFontScaling={false} style={styles.precForLine} numberOfLines={2}>
                {t('dash.prec.forCase', { term: precTerm || (selectedCase?.title ?? '') })}
              </Text>

              {precedents.isLoading ? (
                <View style={styles.precLoading}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text allowFontScaling={false} style={styles.precLoadingText}>{t('dash.prec.searching')}</Text>
                </View>
              ) : precedents.isError ? (
                <View style={styles.precLoading}>
                  <Ionicons name="cloud-offline-outline" size={18} color={colors.textMuted} />
                  <Text allowFontScaling={false} style={styles.precLoadingText}>{t('dash.prec.errSource')}</Text>
                  <Pressable onPress={() => precedents.refetch()} hitSlop={6}>
                    <Text allowFontScaling={false} style={styles.precRetry}>{t('dash.prec.retry')}</Text>
                  </Pressable>
                </View>
              ) : (precedents.data?.hits.length ?? 0) === 0 ? (
                <View style={styles.emptyRow}>
                  <Ionicons name="search-outline" size={18} color={colors.textMuted} />
                  <Text allowFontScaling={false} style={styles.emptyRowText}>{t('dash.prec.none')}</Text>
                </View>
              ) : (
                <View>
                  {precedents.data!.hits.slice(0, 3).map((h) => (
                    <Pressable
                      key={h.id}
                      style={({ pressed }) => [styles.precRow, pressed && { opacity: 0.8 }]}
                      onPress={() => router.push(('/ictihat?q=' + encodeURIComponent(precTerm)) as Parameters<typeof router.push>[0])}
                    >
                      <View style={styles.precRowIcon}>
                        <Ionicons name="document-text-outline" size={16} color={colors.primary} />
                      </View>
                      <View style={styles.precRowBody}>
                        <View style={styles.precDaireRow}>
                          <Text allowFontScaling={false} style={styles.precDaire} numberOfLines={1}>
                            {h.daire || t('dash.prec.title')}
                          </Text>
                          {h.matched === false && (
                            <View style={styles.precBadge}>
                              <Text allowFontScaling={false} style={styles.precBadgeText}>{t('dash.prec.near')}</Text>
                            </View>
                          )}
                        </View>
                        <Text allowFontScaling={false} style={styles.precMeta} numberOfLines={1}>
                          {[h.esasNo && `E.${h.esasNo}`, h.kararNo && `K.${h.kararNo}`, h.kararTarihi]
                            .filter(Boolean)
                            .join('  ·  ')}
                        </Text>
                        {!!h.snippet && (
                          <Text allowFontScaling={false} style={styles.precSnippet} numberOfLines={2}>
                            {h.snippet}
                          </Text>
                        )}
                      </View>
                    </Pressable>
                  ))}
                  <Pressable
                    style={({ pressed }) => [styles.focusButton, pressed && { opacity: 0.8 }]}
                    onPress={() => router.push(('/ictihat?q=' + encodeURIComponent(precTerm)) as Parameters<typeof router.push>[0])}
                  >
                    <Text allowFontScaling={false} style={styles.focusButtonText}>
                      {t('dash.prec.seeAll')}
                      {precedents.data!.total > 3 ? `  (${precedents.data!.total})` : ''}
                    </Text>
                    <Ionicons name="chevron-forward" size={15} color={colors.primary} />
                  </Pressable>
                </View>
              )}
            </View>
          )}
        </View>
        )}

        {/* ---------- Finansal Özet ---------- */}
        <View style={[styles.card, blok('ucteBir'), panoMu && styles.panoMarjsiz]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.cardHeaderIcon}>
                <Ionicons name="stats-chart-outline" size={15} color={colors.primary} />
              </View>
              <Text allowFontScaling={false} style={styles.cardTitle}>{t('dash.fin.title')}</Text>
            </View>
            <Pressable style={styles.cardHeaderRight} onPress={() => router.push('/finance' as Parameters<typeof router.push>[0])} hitSlop={6}>
              <Text allowFontScaling={false} style={styles.cardHeaderLink}>{t('dash.fin.month')}</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
            </Pressable>
          </View>

          <View style={styles.finRow}>
            <FinCell label={t('dash.fin.income')} amount={fin.income} pct={fin.incomePct} positiveIsGood series={fin.incomeSeries} barColor={colors.success} vsLabel={t('dash.fin.vs')} />
            <View style={styles.finDivider} />
            <FinCell label={t('dash.fin.expense')} amount={fin.expense} pct={fin.expensePct} positiveIsGood={false} series={fin.expenseSeries} barColor={colors.danger} vsLabel={t('dash.fin.vs')} />
            <View style={styles.finDivider} />
            <FinCell label={t('dash.fin.net')} amount={fin.net} pct={fin.netPct} positiveIsGood series={fin.netSeries} barColor={colors.success} vsLabel={t('dash.fin.vs')} />
          </View>
        </View>

        {/* ---------- Yaklaşan Süreler (yalnız pano) ----------
             NEDEN YENİ. Ana ekranda süreler yalnız "bugün" kutusunda ve tek
             bir "sıradaki" satırında görünüyordu; yarından sonrası hiç
             görünmüyordu. Süre kaçırmanın en yaygın sebebi tam olarak bu:
             bugüne bakmak, haftaya bakmamak. Telefonda eklenmedi çünkü orada
             ekranın altına düşer ve görülmez — bu kart görülmek için var. */}
        {panoMu && (
          <View style={[styles.card, blok('ikiUcte'), styles.panoMarjsiz]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View style={styles.cardHeaderIcon}>
                  <Ionicons name="hourglass-outline" size={15} color={colors.primary} />
                </View>
                <Text allowFontScaling={false} style={styles.cardTitle}>{t('dash.upcoming.title')}</Text>
              </View>
              <Pressable style={styles.cardHeaderRight} onPress={() => router.push('/(app)/calendar')} hitSlop={6}>
                <Text allowFontScaling={false} style={styles.cardHeaderLink}>{t('dash.upcoming.all')}</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.primary} />
              </Pressable>
            </View>

            {deadlines.isPending ? (
              <ActivityIndicator color={colors.textSecondary} style={{ paddingVertical: spacing.lg }} />
            ) : yaklasanSureler.length === 0 ? (
              <Text allowFontScaling={false} style={styles.bosDurum}>{t('dash.upcoming.empty')}</Text>
            ) : (
              yaklasanSureler.map((s, i) => {
                // RENK BİR UYARI, SÜS DEĞİL: geçmiş ve bugün kırmızı, üç güne
                // kadar altın, ötesi nötr. Avukat listeye bakmadan hangi satıra
                // bugün dokunması gerektiğini görüyor.
                const acil = s.kalanGun <= 0;
                const yakin = s.kalanGun > 0 && s.kalanGun <= 3;
                const renk = acil ? colors.danger : yakin ? accentGold : colors.textSecondary;
                return (
                  <Pressable
                    key={s.id}
                    style={({ pressed }) => [
                      styles.sureSatir,
                      i === yaklasanSureler.length - 1 && styles.sureSatirSon,
                      pressed && { opacity: 0.7 },
                    ]}
                    onPress={() => router.push('/(app)/calendar')}
                  >
                    <View style={[styles.sureRozet, { backgroundColor: renk + '1F' }]}>
                      <Text allowFontScaling={false} style={[styles.sureRozetYazi, { color: renk }]}>
                        {acil ? t('dash.upcoming.due') : t('dash.upcoming.days', { n: s.kalanGun })}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text allowFontScaling={false} style={styles.sureBaslik} numberOfLines={1}>{s.baslik}</Text>
                      <Text allowFontScaling={false} style={styles.sureAlt} numberOfLines={1}>
                        {s.dosya ? `${s.dosya} · ${s.tarih}` : s.tarih}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                  </Pressable>
                );
              })
            )}
          </View>
        )}

        {/* ---------- Kısayollar (yalnız pano) ----------
             Telefonda bu kart GEREKSİZ: aynı yollar kenar menüsünde tek
             dokunuş uzakta ve ekranın altında kimse görmez. Masaüstünde ise
             panonun sağ alt köşesi zaten boştu ve en sık açılan altı ekran
             oraya sığıyor. */}
        {panoMu && (
          <View style={[styles.card, blok('tam'), styles.panoMarjsiz]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View style={styles.cardHeaderIcon}>
                  <Ionicons name="flash-outline" size={15} color={colors.primary} />
                </View>
                <Text allowFontScaling={false} style={styles.cardTitle}>{t('dash.quick.title')}</Text>
              </View>
            </View>
            <View style={styles.kisayolIzgara}>
              {[
                { ikon: 'search-outline', yazi: t('dash.quick.ictihat'), yol: '/ictihat' },
                { ikon: 'document-text-outline', yazi: t('dash.quick.dilekce'), yol: '/dilekce-uret' },
                { ikon: 'cloud-upload-outline', yazi: t('dash.quick.aktar'), yol: '/dosya-aktar' },
                { ikon: 'calculator-outline', yazi: t('dash.quick.hesap'), yol: '/calculators' },
                { ikon: 'library-outline', yazi: t('dash.quick.mevzuat'), yol: '/laws' },
                { ikon: 'wallet-outline', yazi: t('dash.quick.finans'), yol: '/finance' },
              ].map((k) => (
                <Pressable
                  key={k.yol}
                  style={({ pressed }) => [styles.kisayol, pressed && { opacity: 0.75 }]}
                  onPress={() => router.push(k.yol as Parameters<typeof router.push>[0])}
                >
                  <Ionicons name={k.ikon as keyof typeof Ionicons.glyphMap} size={16} color={colors.primary} />
                  <Text allowFontScaling={false} style={styles.kisayolYazi} numberOfLines={1}>{k.yazi}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* ---------- Alt navigasyon ----------
           KALICI MENÜ VARKEN GİZLENİYOR. Masaüstünde solda zaten sürekli bir
           menü duruyor ve alt çubuk aynı üç yolu ikinci kez gösteriyordu:
           ekranın altından ~70 px yer alıyor, aynı hedefe iki giriş sunarak
           "hangisi doğru" sorusunu doğuruyordu. Telefonda hiçbir şey
           değişmiyor — orada yan menü kalıcı değil ve alt çubuk asıl
           gezinme yolu. */}
      {!kaliciMenu && (
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <BottomTab icon="folder-open-outline" label={t('tab.fileIndex')} active onPress={() => router.push('/(app)/cases')} />
        <BottomTab icon="calendar-outline" label={t('tab.calendar')} onPress={() => router.push('/(app)/calendar')} />
        <BottomTab icon="people-outline" label={t('tab.clients')} onPress={() => router.push('/(app)/clients')} />
      </View>
      )}
    </View>
  );
}

/**
 * Panonun üst şeridindeki tek bir sayı.
 *
 * `deger` null ise çizgi gösterir. Bu bilinçli: veri yüklenirken 0 basmak
 * "hiç dosyan yok" demekle aynı şey ve avukat bir an için verisini
 * kaybettiğini sanır.
 */
function PanoSayi({ etiket, deger }: { etiket: string; deger: number | null }) {
  const __t = useTheme();
  const styles = makeStyles(__t.colors);
  return (
    <View style={styles.panoSayiKutu}>
      <Text allowFontScaling={false} style={styles.panoSayiEtiket} numberOfLines={1}>{etiket}</Text>
      <Text allowFontScaling={false} style={styles.panoSayiDeger}>{deger === null ? '—' : deger}</Text>
    </View>
  );
}

function AssistRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onPress: () => void;
}) {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  return (
    <Pressable style={({ pressed }) => [styles.assistRow, pressed && { opacity: 0.8 }]} onPress={onPress}>
      <View style={styles.assistIcon}>
        <Ionicons name={icon} size={15} color={colors.primary} />
      </View>
      <View style={styles.assistBody}>
        <Text allowFontScaling={false} style={styles.assistLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text allowFontScaling={false} style={styles.assistValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
    </Pressable>
  );
}

function FinCell({
  label,
  amount,
  pct,
  positiveIsGood,
  series,
  barColor,
  vsLabel,
}: {
  label: string;
  amount: number;
  pct: number | null;
  positiveIsGood: boolean;
  series: number[];
  barColor: string;
  vsLabel: string;
}) {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  const max = Math.max(...series, 1);
  const hasData = series.some((v) => v > 0);
  // Veri yokken DÜZ ve sönük bir taban çizgisi göster. Eskiden yükselen sahte
  // bir dalga çiziliyordu; finans ekranında olmayan bir artış trendi ima ettiği
  // için yanıltıcıydı (tutar ₺0 iken grafik yükseliyor gibi görünüyordu).
  const heights = hasData
    ? series.slice(0, 7).map((v) => 4 + Math.round((v / max) * 18))
    : [4, 4, 4, 4, 4, 4, 4];
  const good = pct == null ? true : positiveIsGood ? pct >= 0 : pct <= 0;
  return (
    <View style={styles.finCell}>
      <Text allowFontScaling={false} style={styles.finLabel} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.finMidRow}>
        <Text allowFontScaling={false} style={styles.finAmount} numberOfLines={1} adjustsFontSizeToFit>
          {formatMoney(amount)}
        </Text>
        <View style={styles.finSpark}>
          {heights.map((h, i) => (
            <View
              key={i}
              style={[styles.finBar, { height: h, backgroundColor: barColor, opacity: hasData ? 0.9 : 0.35 }]}
            />
          ))}
        </View>
      </View>
      <View style={styles.finPctRow}>
        {pct != null ? (
          <>
            <Ionicons name={pct >= 0 ? 'arrow-up' : 'arrow-down'} size={11} color={good ? colors.success : colors.danger} />
            <Text allowFontScaling={false} style={[styles.finPct, { color: good ? colors.success : colors.danger }]} numberOfLines={2}>
              %{Math.abs(pct)} {vsLabel}
            </Text>
          </>
        ) : (
          <Text allowFontScaling={false} style={[styles.finPct, { color: colors.textMuted }]} numberOfLines={2}>
            %0 {vsLabel}
          </Text>
        )}
      </View>
    </View>
  );
}

function BottomTab({
  icon,
  label,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  return (
    <Pressable style={styles.bottomTab} onPress={onPress}>
      <View style={[styles.bottomTabIndicator, active && styles.bottomTabIndicatorActive]} />
      <Ionicons name={icon} size={20} color={active ? colors.primary : colors.textMuted} />
      <Text
        allowFontScaling={false}
        style={[styles.bottomTabLabel, active && styles.bottomTabLabelActive]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },

  /* ── PANO (yalnız geniş tarayıcı) ──────────────────────────────────────
     Kartların kendi `marginBottom`u tek sütunlu telefon düzeni için var.
     Izgarada boşluğu `rowGap` yönetiyor; marj kalsaydı satır araları iki
     kat açılır ve pano dağınık görünürdü. */
  panoMarjsiz: {
    marginBottom: 0,
  },
  /** Karşılama + dört sayı aynı satırda; dar ekranda alt alta. */
  panoBaslikSatiri: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.lg,
    flexWrap: 'wrap',
  },
  panoSayilar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.lg,
  },
  panoSayiKutu: {
    minWidth: 84,
  },
  panoSayiEtiket: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: 2,
  },
  panoSayiDeger: {
    fontFamily: SERIF,
    fontSize: 26,
    lineHeight: 30,
    color: colors.textPrimary,
  },
  /** Yaklaşan süreler listesi. */
  sureSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sureSatirSon: {
    borderBottomWidth: 0,
  },
  sureRozet: {
    minWidth: 54,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  sureRozetYazi: {
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  sureBaslik: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  sureAlt: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  bosDurum: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
    paddingVertical: spacing.md,
  },
  /** Kısayol ızgarası. */
  kisayolIzgara: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kisayol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    flexGrow: 1,
    flexBasis: 140,
  },
  kisayolYazi: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  toolbarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandText: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    fontSize: 19,
    letterSpacing: -0.4,
    color: colors.textPrimary,
  },
  brandTextPro: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    color: colors.primary,
  },
  toolbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bellButton: {
    padding: 4,
  },
  greeting: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    fontSize: 28,
    lineHeight: 32,
    color: colors.textPrimary,
    letterSpacing: -0.7,
  },
  greetingSub: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.textSecondary,
    marginTop: 5,
    marginBottom: spacing.lg,
  },
  outcomeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.primarySoft,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  outcomeIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outcomeTitle: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    fontSize: 14,
    color: colors.textPrimary,
  },
  outcomeDesc: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
    marginTop: 2,
  },
  trialPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    paddingLeft: 12,
    paddingRight: 10,
    paddingVertical: 7,
    marginBottom: spacing.lg,
  },
  trialPillText: {
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 12.5,
    color: colors.primary,
  },
  hero: {
    borderRadius: 24,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow.card,
  },
  // Masraf avansı uyarısı
  advanceAlert: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  advanceAlertHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  advanceAlertTitle: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.danger,
    flex: 1,
  },
  advanceAlertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.dangerSoft,
  },
  advanceAlertInfo: {
    flex: 1,
  },
  advanceAlertName: {
    fontFamily: fonts.semibold,
    fontSize: 13.5,
    color: colors.textPrimary,
  },
  advanceAlertAmount: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.danger,
    marginTop: 1,
  },
  advanceAlertClose: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  advanceAlertMore: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
    color: colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  heroSparkIcon: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    fontSize: 11,
    color: colors.primary,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  heroUpdatedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  // Sıradaki (büyük kart)
  nextMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  timeBlock: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    minWidth: 62,
  },
  timeHH: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    fontSize: 17,
    letterSpacing: -0.4,
    color: '#FFFFFF',
  },
  timeDay: {
    fontFamily: fonts.semibold,
    fontWeight: '600',
    fontSize: 9.5,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
    letterSpacing: 0.4,
  },
  nextBody: {
    flex: 1,
  },
  nextTitle: {
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 15.5,
    letterSpacing: -0.2,
    color: colors.textPrimary,
  },
  nextSub: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    color: colors.textMuted,
    marginTop: 3,
  },
  nextEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  nextEmptyText: {
    fontFamily: fonts.medium,
    fontSize: 13.5,
    color: colors.textMuted,
  },
  // Bugün listesi
  bugunLabel: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginTop: spacing.lg,
    marginBottom: 2,
  },
  todayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
  },
  todayDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  todayTitle: {
    fontFamily: fonts.semibold,
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: -0.1,
    color: colors.textPrimary,
    flex: 1,
  },
  todayTime: {
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 13,
    color: colors.textSecondary,
  },
  todayEmpty: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
    paddingVertical: spacing.sm,
  },
  heroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  heroUpdated: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  heroRows: {
    gap: 0,
  },
  assistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
  },
  assistIcon: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assistBody: {
    flex: 1,
  },
  assistLabel: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
    color: colors.textMuted,
    letterSpacing: 0.1,
  },
  assistValue: {
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 14.5,
    color: colors.textPrimary,
    letterSpacing: -0.2,
    marginTop: 2,
  },
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 14,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    marginTop: spacing.md,
  },
  todayEmptyWrap: {
    marginTop: spacing.xs,
  },
  heroCtaText: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    fontSize: 14,
    color: onGoldColor(colors.gold),
    letterSpacing: 0.2,
  },
  card: {
    borderRadius: 24,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  cardHeaderIcon: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    fontSize: 16.5,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  cardHeaderLink: {
    fontFamily: fonts.semibold,
    fontWeight: '600',
    fontSize: 13,
    color: colors.primary,
  },
  focusRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  focusIcon: {
    width: 58,
    height: 58,
    borderRadius: 15,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusBody: {
    flex: 1,
  },
  focusTitle: {
    fontFamily: SERIF,
    fontSize: 15.5,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  focusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 3,
    marginTop: 7,
  },
  focusBadgeText: {
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 11,
    color: colors.danger,
  },
  focusMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
  },
  focusMeta: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  focusReason: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
    marginTop: 5,
  },
  focusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 13,
    backgroundColor: colors.primarySoft,
    paddingVertical: 12,
    marginTop: spacing.sm,
  },
  focusButtonText: {
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 13.5,
    letterSpacing: -0.1,
    color: colors.primary,
  },
  // Davana Emsal
  precChipRow: {
    gap: 6,
    paddingBottom: spacing.sm,
    paddingRight: 4,
  },
  precChip: {
    maxWidth: 190,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  precChipActive: {
    backgroundColor: colors.primary,
  },
  precChipText: {
    fontFamily: fonts.semibold,
    fontWeight: '600',
    fontSize: 12.5,
    letterSpacing: -0.1,
    color: colors.textSecondary,
  },
  precChipTextActive: {
    color: '#FFFFFF',
  },
  precForLine: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  precLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  precLoadingText: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  precRetry: {
    fontFamily: fonts.semibold,
    fontWeight: '600',
    fontSize: 12.5,
    color: colors.primary,
  },
  precRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
  },
  precRowIcon: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  precRowBody: {
    flex: 1,
  },
  precDaireRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  precDaire: {
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 13,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  precBadge: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  precBadgeText: {
    fontFamily: fonts.semibold,
    fontWeight: '600',
    fontSize: 9.5,
    color: colors.textMuted,
  },
  precMeta: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  precSnippet: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.textSecondary,
    marginTop: 4,
  },
  precEmpty: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  precEmptyText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  emptyRowText: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 19,
  },
  finRow: {
    flexDirection: 'row',
  },
  finCell: {
    flex: 1,
    paddingHorizontal: 2,
  },
  finDivider: {
    width: 1,
    backgroundColor: colors.borderSubtle,
    marginHorizontal: spacing.xs,
  },
  finLabel: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  finMidRow: {
    gap: 4,
  },
  finAmount: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    fontSize: 13.5,
    color: colors.textPrimary,
  },
  finSpark: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 22,
    marginTop: 4,
  },
  finBar: {
    width: 5,
    borderRadius: 2,
  },
  finPctRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  finPct: {
    fontFamily: fonts.semibold,
    fontWeight: '600',
    fontSize: 10.5,
    flexShrink: 1,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: 4,
  },
  bottomTab: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
  },
  bottomTabIndicator: {
    width: 30,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: 'transparent',
    marginBottom: 3,
  },
  bottomTabIndicatorActive: {
    backgroundColor: colors.primary,
  },
  bottomTabLabel: {
    fontFamily: fonts.semibold,
    fontWeight: '600',
    fontSize: 11,
    color: colors.textMuted,
  },
  bottomTabLabelActive: {
    color: colors.primary,
    fontFamily: fonts.extrabold,
    fontWeight: '800',
  },
});
