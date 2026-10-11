import { useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { uyar } from '@/lib/uyari';
import DateTimePicker from '@/components/ui/TarihSecici';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAllHearings, useCreateHearing, useUpdateHearing } from '@/hooks/useHearings';
import { useAllDeadlines, useCreateDeadline } from '@/hooks/useDeadlines';
import {
  OUTCOMES,
  OUTCOME_ORDER,
  ayniDurusmaVarMi,
  ayniSureVarMi,
  kayittanSonra,
  needsServiceWatch,
  pendingOutcomeHearings,
  planDeadline,
  kanuniSureGun,
  sonrakiSira,
  tebligatTakipTarihi,
  varsayilanSonrakiDurusma,
  type OutcomeId,
} from '@/utils/hearingOutcome';
import { cakismaBul } from '@/utils/durusmaCakismasi';
import { useT } from '@/i18n';
import { fonts, spacing, shadow, kose } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { formatDate, formatDateTime, formatTime } from '@/utils/format';
import { geriDon } from '@/lib/geriDon';

/**
 * DURUŞMA ÇIKIŞI — duruşma bittikten sonraki 60 saniye.
 *
 * Avukat adliyeden çıkarken ne olduğunu bilir; akşama unutur. Uygulamadaki
 * gerçek veri de bunu gösteriyordu (duruşma sayısı süre kaydının kat kat
 * üstünde). Bu ekran sonucu 3 dokunuşta alır ve hukuki sonuçları KENDİSİ
 * oluşturur: sonraki duruşma + kanuni süre.
 *
 * Kanun yoluna başvuru süreleri tebliğden işlediği için (HMK 345/361) "karar
 * açıklandı" seçildiğinde süre uydurulmaz — tebligat tarihi girilirse hesaplanır,
 * girilmezse tebligatı takip hatırlatması kurulur.
 */
export default function DurusmaCikisiScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  const t = useT();

  const hearings = useAllHearings();
  const updateHearing = useUpdateHearing();
  const createHearing = useCreateHearing();
  const createDeadline = useCreateDeadline();
  const deadlines = useAllDeadlines();

  const pending = useMemo(
    () => pendingOutcomeHearings(hearings.data ?? []),
    [hearings.data]
  );

  const [idx, setIdx] = useState(0);
  const current = pending[idx];

  const [outcome, setOutcome] = useState<OutcomeId | null>(null);
  // Sonraki duruşma: kullanıcı değiştirmediyse bu duruşmanın saatinde, bugünden 30 gün sonra.
  // (Eskiden saat 09:30'a sabitti ve seçilemiyordu.)
  const [nextOverride, setNextOverride] = useState<Date | null>(null);
  const [hasService, setHasService] = useState(false);
  const [serviceDate, setServiceDate] = useState<Date>(new Date());
  const [customDays, setCustomDays] = useState('');
  const [note, setNote] = useState('');
  const [picker, setPicker] = useState<'next' | 'nextTime' | 'service' | null>(null);
  const [busy, setBusy] = useState(false);
  // setBusy bir sonraki çizimde etkili olur; arka arkaya iki dokunuşu bu kilit eler.
  const kilit = useRef(false);

  /**
   * YARIM KALAN KAYDIN TEKRARINDA ÇİFT KAYIT OLUŞMASIN.
   *
   * Bu ekran tek "Kaydet" ile üç-dört ayrı yazma yapıyor. Ortada biri
   * başarısız olursa (adliyede çekmeyen hat — bu ekranın kullanıldığı yer tam
   * da orası) kullanıcı hatayı görüp tekrar basıyordu ve ÖNCEKİ ADIMLAR
   * BAŞTAN çalışıyordu: ikinci bir "sonraki duruşma", ikinci bir süre kaydı ve
   * duruşma notuna ikinci kez eklenmiş aynı satır.
   *
   * Başarılı adımlar duruşma kimliğine göre işaretleniyor; tekrar denemede
   * kaldığı yerden devam ediyor.
   */
  const tamamlananAdimlar = useRef<Record<string, Set<string>>>({});
  const adimBitti = (id: string, adim: string) => tamamlananAdimlar.current[id]?.has(adim) ?? false;
  const adimIsaretle = (id: string, adim: string) => {
    (tamamlananAdimlar.current[id] ??= new Set<string>()).add(adim);
  };

  const varsayilanSonraki = useMemo(
    () => varsayilanSonrakiDurusma(current ? new Date(current.scheduled_at) : new Date()),
    [current?.scheduled_at]
  );
  const nextDate = nextOverride ?? varsayilanSonraki;

  const def = outcome ? OUTCOMES[outcome] : null;
  const hearingDate = current ? new Date(current.scheduled_at) : new Date();
  const kategori = current?.case?.court_category ?? null;
  const tebligKullan = hasService || !!def?.serviceDateRequired;
  const plan = outcome
    ? planDeadline(outcome, hearingDate, tebligKullan ? serviceDate : null, Number(customDays) || undefined, kategori)
    : null;
  const kanuniGun = outcome ? kanuniSureGun(outcome, kategori) : undefined;
  const watchService = outcome ? needsServiceWatch(outcome, hasService ? serviceDate : null) : false;

  // Sonraki duruşma başka bir işle çakışıyor mu? Yeni kayıt henüz yok; aynı dosyada
  // AYNI ana kayıtlı duruşma (yarım kalmış önceki denemenin yazdığı) çakışma sayılmaz.
  const cakismalar = useMemo(() => {
    if (!current || !def?.needsNextHearing) return [];
    const an = nextDate.getTime();
    return cakismaBul(
      { id: current.id, scheduled_at: nextDate.toISOString(), location: current.location },
      (hearings.data ?? [])
        .filter((h) => !(h.case_id === current.case_id && new Date(h.scheduled_at).getTime() === an))
        .map((h) => ({
          id: h.id,
          scheduled_at: h.scheduled_at,
          title: h.title,
          location: h.location,
          is_completed: h.is_completed,
        }))
    );
  }, [current, def?.needsNextHearing, nextDate, hearings.data]);
  const clash = cakismalar[0] ?? null;
  const clashKaydi = clash ? (hearings.data ?? []).find((h) => h.id === clash.digeri.id) ?? null : null;

  const resetForNext = () => {
    setOutcome(null);
    setNextOverride(null);
    setHasService(false);
    setCustomDays('');
    setNote('');
    setPicker(null);
  };

  /** Kayıttan sonra: bekleyen KALMADIYSA bitir, atlananlar varsa başa dön. */
  const kayitSonrasi = () => {
    const sonuc = kayittanSonra(idx, pending.length);
    resetForNext();
    setIdx(sonuc.idx);
    if (sonuc.bitti) {
      uyar(t('hout.title'), t('hout.allDone'), [{ text: t('common.done'), onPress: () => geriDon() }]);
    }
  };

  /** Sonuç girmeden kapat: süre/duruşma OLUŞTURMAZ; yalnız duruşmayı tamamlandı yapar. */
  const kapatYalniz = () => {
    if (!current || busy || kilit.current) return;
    const hId = current.id;
    const caseTitle = current.case?.title ?? current.title;
    const notu = note.trim();
    const kaydet = async () => {
      if (kilit.current) return;
      kilit.current = true;
      setBusy(true);
      try {
        await updateHearing.mutateAsync({
          id: hId,
          caseTitle,
          is_completed: true,
          ...(notu ? { notes: [current.notes, notu].filter(Boolean).join('\n') } : {}),
        });
        kayitSonrasi();
      } catch {
        // hata uyarısı notifySaveError ile gösterildi
      } finally {
        kilit.current = false;
        setBusy(false);
      }
    };
    uyar(t('hout.title'), t('hout.closeOnlyMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('hout.closeOnlyConfirm'), style: 'destructive', onPress: () => { void kaydet(); } },
    ]);
  };

  const save = async () => {
    if (!current || !outcome || busy || kilit.current) return;
    kilit.current = true;
    setBusy(true);
    const caseTitle = current.case?.title ?? current.title;
    const hId = current.id;
    try {
      /**
       * SIRA DEĞİŞTİ: ÖNCE SÜRE, EN SON "TAMAMLANDI".
       *
       * BULUNAN KUSUR. Önce duruşma "tamamlandı" işaretleniyor, süre kaydı
       * sonra oluşturuluyordu. Aradaki herhangi bir hata (ağ kopması) şu sonucu
       * veriyordu: duruşma tamamlanmış sayılır, SÜRE HİÇ OLUŞMAZ ve duruşma
       * artık "sonucu girilmemiş" listesinden düştüğü için uygulama BİR DAHA
       * HİÇ SORMAZ. Yani bu ekranın var olma sebebi olan kaybın (49 duruşma, 9
       * süre) tam olarak kendisini üretebiliyordu — üstelik sessizce.
       *
       * Artık en değerli kayıt önce yazılıyor. Bir şey ters giderse duruşma
       * tamamlanmamış kalır, bekleyenler listesinde durur ve ekran tekrar sorar.
       */

      // 1) Süre (hesaplanabiliyorsa) — en değerli kayıt, en önce.
      // Aynı süre kayıtlıysa (yarım kalmış önceki deneme, başka oturum) tekrar yazılmaz.
      if (plan && !adimBitti(hId, 'sure')) {
        const baslik = `${t(`hout.d.${plan.key}` as const)}${plan.basis ? ` (${plan.basis})` : ''}`;
        const dueIso = plan.dueAt.toISOString();
        if (!ayniSureVarMi(deadlines.data ?? [], current.case_id, baslik, dueIso)) {
          await createDeadline.mutateAsync({
            case_id: current.case_id,
            title: baslik,
            description: plan.fromService ? t(plan.key === 'bilirkisiItiraz' ? 'hout.fromRaporNote' : 'hout.fromServiceNote') : null,
            due_at: dueIso,
            priority: 'high',
            reminder_minutes_before: 1440,
            caseTitle,
          });
        }
        adimIsaretle(hId, 'sure');
      }

      // 2) Tebligat bekleniyorsa takip işi kur (süre uydurma!).
      if (watchService && !adimBitti(hId, 'takip')) {
        const dueIso = tebligatTakipTarihi(hearingDate).toISOString();
        if (!ayniSureVarMi(deadlines.data ?? [], current.case_id, t('hout.watchTitle'), dueIso)) {
          await createDeadline.mutateAsync({
            case_id: current.case_id,
            title: t('hout.watchTitle'),
            description: t('hout.watchDesc'),
            due_at: dueIso,
            priority: 'high',
            reminder_minutes_before: 1440,
            caseTitle,
          });
        }
        adimIsaretle(hId, 'takip');
      }

      // 3) Sonraki duruşma (gerekiyorsa)
      if (def?.needsNextHearing && !adimBitti(hId, 'sonraki')) {
        // O dosyada o anda duruşma zaten kayıtlıysa (önceki yarım deneme ya da avukatın
        // elle girdiği) ikincisi açılmaz.
        if (!ayniDurusmaVarMi(hearings.data ?? [], current.case_id, nextDate.toISOString())) {
          await createHearing.mutateAsync({
            case_id: current.case_id,
            title: current.title,
            type: current.type,
            location: current.location,
            scheduled_at: nextDate.toISOString(),
            reminder_minutes_before: current.reminder_minutes_before ?? 60,
            notes: null,
            caseTitle,
          });
        }
        adimIsaretle(hId, 'sonraki');
      }

      // 4) EN SON: duruşmayı tamamlandı işaretle, sonucu nota yaz. Bu adım
      //    duruşmayı bekleyenler listesinden düşürdüğü için en sona alındı.
      if (!adimBitti(hId, 'durusma')) {
        const outcomeLabel = t(`hout.o.${outcome}` as const);
        const noteLine = [outcomeLabel, note.trim()].filter(Boolean).join(' — ');
        await updateHearing.mutateAsync({
          id: hId,
          caseTitle,
          is_completed: true,
          notes: [current.notes, noteLine].filter(Boolean).join('\n'),
        });
        adimIsaretle(hId, 'durusma');
      }

      // Sıradaki duruşmaya geç (bekleyen kalmadıysa bitir)
      kayitSonrasi();
    } catch {
      // hata uyarısı notifySaveError ile gösterildi
    } finally {
      kilit.current = false;
      setBusy(false);
    }
  };

  if (hearings.isLoading) {
    return (
      <Screen edges={['top', 'left', 'right', 'bottom']}>
        <ScreenHeader title={t('hout.title')} showBack />
      </Screen>
    );
  }

  // Sorgu hata verdiyse "bekleyen yok" DENMEZ: veri gelmedi, bekleyen olup olmadığı bilinmiyor.
  if (hearings.isError && !hearings.data) {
    return (
      <Screen edges={['top', 'left', 'right', 'bottom']}>
        <ScreenHeader title={t('hout.title')} showBack />
        <EmptyState
          icon="cloud-offline-outline"
          title={t('hout.loadError')}
          description={t('hout.loadErrorDesc')}
          actionLabel={t('hout.retry')}
          onAction={() => hearings.refetch()}
        />
      </Screen>
    );
  }

  if (!current) {
    return (
      <Screen edges={['top', 'left', 'right', 'bottom']}>
        <ScreenHeader title={t('hout.title')} showBack />
        <EmptyState icon="checkmark-done-outline" title={t('hout.emptyTitle')} description={t('hout.emptyDesc')} />
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('hout.title')} showBack />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.counter}>{t('hout.counter', { n: idx + 1, total: pending.length })}</Text>

        {/* Hangi duruşma */}
        <View style={styles.hearingCard}>
          <Text style={styles.hearingTitle} numberOfLines={2}>{current.case?.title ?? current.title}</Text>
          <View style={styles.hearingMetaRow}>
            <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
            <Text style={styles.hearingMeta}>{formatDate(current.scheduled_at)}</Text>
            {!!current.location && (
              <>
                <Ionicons name="location-outline" size={13} color={colors.textMuted} />
                <Text style={styles.hearingMeta} numberOfLines={1}>{current.location}</Text>
              </>
            )}
          </View>
        </View>

        {/* 1) Ne oldu? */}
        <Text style={styles.label}>{t('hout.whatHappened')}</Text>
        <View style={styles.chips}>
          {OUTCOME_ORDER.map((id) => {
            const on = outcome === id;
            return (
              <Pressable
                key={id}
                onPress={() => {
                  setOutcome(id);
                  // Rapor tebliği sorulan sonuçta varsayılan duruşma günü (rapor
                  // çoğu zaman duruşmada verilir); avukat değiştirebilir.
                  if (OUTCOMES[id].serviceDateRequired) setServiceDate(hearingDate);
                }}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{t(`hout.o.${id}` as const)}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* 2) Sonraki duruşma */}
        {def?.needsNextHearing && (
          <>
            <Text style={styles.label}>{t('hout.nextHearing')}</Text>
            <View style={styles.dateRow}>
              <Pressable style={[styles.dateBtn, styles.dateBtnGun]} onPress={() => setPicker(picker === 'next' ? null : 'next')}>
                <Ionicons name="calendar" size={16} color={colors.primary} />
                <Text style={styles.dateBtnText}>{formatDate(nextDate.toISOString())}</Text>
              </Pressable>
              <Pressable
                style={[styles.dateBtn, styles.dateBtnSaat]}
                onPress={() => setPicker(picker === 'nextTime' ? null : 'nextTime')}
                accessibilityRole="button"
                accessibilityLabel={t('hout.timeA11y')}
              >
                <Ionicons name="time-outline" size={16} color={colors.primary} />
                <Text style={styles.dateBtnText}>{formatTime(nextDate.toISOString())}</Text>
              </Pressable>
            </View>
            {clash && (
              <View style={[styles.warnBox, clash.tur === 'ortusuyor' && styles.warnBoxAgir]}>
                <Ionicons
                  name={clash.tur === 'ortusuyor' ? 'alert-circle' : 'warning'}
                  size={18}
                  color={clash.tur === 'ortusuyor' ? colors.danger : colors.warning}
                />
                <Text style={styles.warnText}>
                  {t(
                    clash.tur === 'ortusuyor'
                      ? 'clash.ortusuyor'
                      : clash.tur === 'yol_yetmez'
                        ? 'clash.yolYetmez'
                        : 'clash.sikisik',
                    {
                      title: clash.digeri.title,
                      time: formatTime(clash.digeri.scheduled_at),
                      fark: String(clash.farkDk),
                      caseInfo: clashKaydi?.case?.title ? ` · ${clashKaydi.case.title}` : '',
                    }
                  )}
                  {cakismalar.length > 1 ? ` ${t('clash.digerleri', { n: String(cakismalar.length - 1) })}` : ''}
                </Text>
              </View>
            )}
          </>
        )}

        {/* 3) Tebliğden işleyen süre → tebligat tarihi */}
        {def?.runsFromService && (
          <View style={styles.serviceBox}>
            <View style={styles.serviceHead}>
              <Ionicons name="mail-outline" size={16} color={colors.primary} />
              <Text style={styles.serviceTitle}>{t('hout.serviceQ')}</Text>
              <Switch value={hasService} onValueChange={setHasService} />
            </View>
            <Text style={styles.serviceHint}>{t('hout.serviceHint')}</Text>
            {hasService && (
              <Pressable style={styles.dateBtn} onPress={() => setPicker(picker === 'service' ? null : 'service')}>
                <Ionicons name="calendar" size={16} color={colors.primary} />
                <Text style={styles.dateBtnText}>{formatDate(serviceDate.toISOString())}</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* 3b) Raporun tebliğ tarihi (bilirkişi itirazı tebliğden işler) */}
        {def?.serviceDateRequired && (
          <View style={styles.serviceBox}>
            <View style={styles.serviceHead}>
              <Ionicons name="mail-outline" size={16} color={colors.primary} />
              <Text style={styles.serviceTitle}>{t('hout.raporTebligQ')}</Text>
            </View>
            <Text style={styles.serviceHint}>{t('hout.raporTebligHint')}</Text>
            <Pressable style={styles.dateBtn} onPress={() => setPicker(picker === 'service' ? null : 'service')}>
              <Ionicons name="calendar" size={16} color={colors.primary} />
              <Text style={styles.dateBtnText}>{formatDate(serviceDate.toISOString())}</Text>
            </Pressable>
          </View>
        )}

        {/* 4) Süre gün sayısı (hâkimin verdiği süre farklıysa) */}
        {!!def?.deadlineDays && (
          <>
            <Text style={styles.label}>{t('hout.daysLabel', { d: kanuniGun ?? def.deadlineDays })}</Text>
            <TextInput
              style={styles.daysInput}
              value={customDays}
              onChangeText={setCustomDays}
              placeholder={String(kanuniGun ?? def.deadlineDays)}
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
            />
          </>
        )}

        {/* Önizleme: ne oluşturulacak */}
        {!!outcome && (
          <View style={styles.preview}>
            <Text style={styles.previewTitle}>{t('hout.willCreate')}</Text>
            {def?.needsNextHearing && (
              <Row icon="calendar" color={colors.primary} text={`${t('hout.pvHearing')}: ${formatDateTime(nextDate.toISOString())}`} styles={styles} />
            )}
            {plan && (
              <Row
                icon="alarm"
                color={colors.danger}
                text={`${t(`hout.d.${plan.key}` as const)}: ${formatDate(plan.dueAt.toISOString())}${plan.basis ? ` · ${plan.basis}` : ''}`}
                styles={styles}
              />
            )}
            {watchService && (
              <Row icon="eye" color={colors.warning ?? colors.primary} text={t('hout.pvWatch')} styles={styles} />
            )}
            {!def?.needsNextHearing && !plan && !watchService && (
              <Row icon="checkmark-circle" color={colors.success} text={t('hout.pvOnlyClose')} styles={styles} />
            )}
          </View>
        )}

        {/* Not */}
        <Text style={styles.label}>{t('hout.noteLabel')}</Text>
        <TextInput
          style={styles.noteInput}
          value={note}
          onChangeText={setNote}
          placeholder={t('hout.notePlaceholder')}
          placeholderTextColor={colors.textMuted}
          multiline
          textAlignVertical="top"
        />

        {picker && (
          <View style={styles.pickerPanel}>
            <DateTimePicker
              locale="tr-TR"
              value={picker === 'service' ? serviceDate : nextDate}
              mode={picker === 'nextTime' ? 'time' : 'date'}
              is24Hour
              display="spinner"
              onChange={(e, d) => {
                if (Platform.OS === 'android') setPicker(null);
                if (!d || e.type === 'dismissed') return;
                if (picker === 'service') {
                  setServiceDate(d);
                  return;
                }
                const n = new Date(nextDate);
                if (picker === 'nextTime') n.setHours(d.getHours(), d.getMinutes(), 0, 0);
                else n.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
                setNextOverride(n);
              }}
            />
            {Platform.OS === 'ios' && <Button label={t('common.done')} size="sm" onPress={() => setPicker(null)} fullWidth />}
          </View>
        )}

        <Button
          label={busy ? t('hout.saving') : t('hout.saveCta')}
          onPress={save}
          disabled={!outcome || busy}
          fullWidth
          style={styles.cta}
        />

        <Pressable
          onPress={() => {
            // Tek bekleyen varsa atlayınca ekranda takılma: çık. Birden çoksa sıradakine geç, sonda başa dön.
            if (pending.length <= 1) {
              geriDon();
              return;
            }
            resetForNext();
            setIdx((v) => sonrakiSira(v, pending.length));
          }}
          style={styles.skip}
        >
          <Text style={styles.skipText}>{t('hout.skip')}</Text>
        </Pressable>

        <Pressable onPress={kapatYalniz} disabled={busy} style={styles.skip}>
          <Text style={styles.skipText}>{t('hout.closeOnly')}</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function Row({ icon, color, text, styles }: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  text: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.pvRow}>
      <Ionicons name={icon} size={15} color={color} />
      <Text style={styles.pvText}>{text}</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  counter: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  hearingCard: {
    backgroundColor: colors.surface,
    borderRadius: kose(18),
    padding: spacing.md,
    ...shadow.card,
    marginBottom: spacing.lg,
  },
  hearingTitle: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: -0.3,
    color: colors.textPrimary,
  },
  hearingMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, flexWrap: 'wrap' },
  hearingMeta: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textMuted, flexShrink: 1 },
  label: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  chipOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipText: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary },
  chipTextOn: { fontFamily: fonts.extrabold, fontWeight: '800', color: colors.primary },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: kose(12),
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  dateRow: { flexDirection: 'row', gap: 8 },
  dateBtnGun: { flex: 3 },
  dateBtnSaat: { flex: 2 },
  warnBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: kose(12),
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  warnBoxAgir: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  warnText: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 18, color: colors.textPrimary, flex: 1 },
  dateBtnText: { fontFamily: fonts.bold, fontWeight: '700', fontSize: 14, color: colors.textPrimary },
  serviceBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: kose(16),
    padding: spacing.md,
    marginTop: spacing.md,
    gap: 8,
  },
  serviceHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  serviceTitle: { fontFamily: fonts.bold, fontWeight: '700', fontSize: 13.5, color: colors.textPrimary, flex: 1 },
  serviceHint: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.textSecondary },
  daysInput: {
    backgroundColor: colors.surface,
    borderRadius: kose(12),
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  preview: {
    backgroundColor: colors.primarySoft,
    borderRadius: kose(16),
    padding: spacing.md,
    marginTop: spacing.lg,
    gap: 8,
  },
  previewTitle: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    fontSize: 10.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.primary,
  },
  pvRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  pvText: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: colors.textPrimary, flex: 1 },
  noteInput: {
    minHeight: 70,
    backgroundColor: colors.surface,
    borderRadius: kose(12),
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.md,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textPrimary,
  },
  pickerPanel: { alignItems: 'center', marginTop: spacing.md },
  cta: { marginTop: spacing.lg },
  skip: { alignSelf: 'center', paddingVertical: spacing.md },
  skipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
});
