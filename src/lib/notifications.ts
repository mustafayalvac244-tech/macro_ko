import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { getLang, translate } from '@/i18n';
import { formatDateTime } from '@/utils/format';
import { bildirimMetni, type BildirimKaynagi } from '@/utils/bildirimMetni';
import {
  bildirimVerisi,
  EK_1_GUN,
  EK_3_GUN,
  etkinlikAdaylari,
  kuruluBildirimGuncelMi,
  planBildirimId,
  type BildirimTuru,
  type PlanEtkinligi,
  type PlanliBildirim,
} from '@/utils/bildirimPlani';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const CHANNEL_ID = 'legal-deadlines';

/**
 * BİLDİRİM İZNİNİN SON GÖRÜLEN DURUMU.
 *
 * DÜZELTİLEN KUSUR (09.10.2026 denetimi, kodla doğrulandı). Hatırlatma
 * eşitlemesi (useReminderSync, useMorningDigest) yalnız VERİ yenilenince
 * koşuyordu. İlk girişte izin penceresi açıkken veri gelir, eşitleme izni
 * "henüz yok" görüp çıkar; avukat "İzin ver"e basınca hiçbir şey olmaz — var
 * olan duruşmaların hatırlatması bir sonraki veri yenilemesine (çoğu zaman
 * uygulamanın yeniden açılmasına) kadar kurulmaz. Ayarlardan izin verildiğinde
 * de aynısı. Eşitleme kancaları artık bu duruma bağlı: izin gelince hemen koşar.
 */
export const useBildirimIzni = create<{ izinli: boolean | null }>(() => ({ izinli: null }));

function izinDurumunuYaz(izinli: boolean): void {
  if (useBildirimIzni.getState().izinli !== izinli) useBildirimIzni.setState({ izinli });
}

/**
 * WEB'DE HATIRLATMA BİLDİRİMİ YOK — izin de İSTENMEZ (09.10.2026 denetimi).
 *
 * expo-notifications web'de yerel bildirim kuramıyor (zamanlayıcı modülü web'de
 * boş; belgesi yalnız Android/iOS diyor). Buna rağmen giriş yapılınca tarayıcı
 * "bildirim göndermek istiyor" diye izin soruyor, Ayarlar'daki anahtar izin
 * verilince AÇIK görünüyordu: avukat masaüstünde de hatırlatma alacağını
 * sanıyordu, hiçbir bildirim gelmiyordu.
 */
export async function registerForNotificationsAsync(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Hearings & Deadlines',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#3B6FE0',
    });
  }

  if (!Device.isDevice) return false;

  const existing = await Notifications.getPermissionsAsync();
  let finalStatus = existing.status;
  if (existing.status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }
  const izinli = finalStatus === 'granted';
  izinDurumunuYaz(izinli);
  return izinli;
}

/**
 * Uygulama öne gelince çağrılır: izin cihaz ayarlarından verilmiş/geri alınmış
 * olabilir. İzin İSTEMEZ, yalnız okur. `yeniVerildi` true ise çağıran taraf
 * sunucu bildirim adresini kaydeder.
 */
export async function bildirimIzniniYenile(): Promise<{ izinli: boolean; yeniVerildi: boolean }> {
  if (Platform.OS === 'web') return { izinli: false, yeniVerildi: false };
  const onceki = useBildirimIzni.getState().izinli;
  const { status } = await Notifications.getPermissionsAsync();
  const izinli = status === 'granted';
  izinDurumunuYaz(izinli);
  return { izinli, yeniVerildi: izinli && onceki !== true };
}

/**
 * SUNUCUDAN BİLDİRİM (push) ADRESİ — 30.09.2026 (bkz. 0161_push_bildirim).
 *
 * Önceden hiçbir cihazın adresi kaydedilmiyordu; kayıt olup uygulamayı bir
 * daha açmayan kullanıcıya ulaşmanın yolu yoktu. İzin yoksa izin İSTEMEZ —
 * izni `registerForNotificationsAsync` ister; bu yalnız adresi kaydeder.
 * Web'de ve simülatörde çalışmaz (push yalnız gerçek cihazda var).
 */
let kayitliPushAdresi: string | null = null;

export async function pushAdresiniKaydet(): Promise<void> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  if (!Device.isDevice) return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return;
  const { data: adres } = await Notifications.getExpoPushTokenAsync({ projectId });
  const { error } = await supabase.rpc('push_cihaz_kaydet', { p_token: adres, p_platform: Platform.OS });
  if (!error) kayitliPushAdresi = adres;
}

/**
 * Çıkışta çağrılır: bu telefon, çıkış yapılan hesabın bildirimlerini almasın.
 *
 * Tek savunma bu DEĞİL: adres bellekte yoksa (açılıştaki kayıt ağ yüzünden
 * düştüyse) ya da oturum sunucudan düşürüldüyse (başka cihazdan "tüm
 * oturumları kapat") bu çağrı hiçbir şey silemez. Gönderim, oturumu bitmiş
 * cihazı zaten atlıyor (bkz. 0187_push_oturum_ve_sonuc).
 */
export async function pushAdresiniSil(): Promise<void> {
  if (!kayitliPushAdresi) return;
  await supabase.rpc('push_cihaz_sil', { p_token: kayitliPushAdresi });
  kayitliPushAdresi = null;
}

export async function cancelReminder(id: string): Promise<void> {
  // Cancel the main reminder plus the staged 3-day/1-day companions.
  await Promise.all(
    [id, `${id}${EK_3_GUN}`, `${id}${EK_1_GUN}`].map((identifier) =>
      Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {})
    )
  );
}

/**
 * BİLDİRİM KİMLİKLERİ TEK YERDEN ÜRETİLİR.
 *
 * Bu şema burada ve plan üreticisinde (utils/bildirimPlani.ts) AYRI AYRI
 * yazılsaydı, birinde yapılan bir değişiklik diğerini sessizce bozardı: plan
 * "hearing-x-1d" derken burası "hearing-x-1gun" kursa, eşitleme her açılışta
 * doğru bildirimi iptal edip yenisini kurar ve hiçbir hata görünmezdi. Bu
 * yüzden şemanın tek sahibi bildirimPlani.ts'tir; burası ona sorar.
 */
export function hearingReminderId(hearingId: string): string {
  return planBildirimId('durusma', hearingId, 'secilen');
}

export function deadlineReminderId(deadlineId: string): string {
  return planBildirimId('gorev', deadlineId, 'secilen');
}

export function promiseReminderId(promiseId: string): string {
  return planBildirimId('soz', promiseId, 'secilen');
}

/**
 * DURUŞMADAN SONRA SORAN BİLDİRİM — süre kaydının eksik halkası.
 *
 * ÖLÇÜLEN ARIZA (canlı veri): 49 duruşma kaydına karşılık 9 süre kaydı; geçmiş
 * 23 duruşmanın 22'si "tamamlandı" bile işaretlenmemiş. Dört ayrı avukatta,
 * temmuz-eylül aralığında. Yani duruşmada verilen süreler uygulamaya HİÇ
 * girmiyor — ve süre kaçırmak, avukatın mesleki sorumluluğunun ana kaynağı.
 *
 * Mekanizma zaten vardı: duruşma çıkışı ekranı da, ana ekrandaki hatırlatma
 * kartı da yazılmıştı. Eksik olan, doğru ANDA sormaktı. Duruşmadan çıkan avukat
 * uygulamayı açıp kart aramaz; kart ancak uygulamayı zaten açtıysa görünür.
 *
 * SORULACAK AN: duruşmadan iki saat sonra (SONUC_GECIKME_DAKIKA). Duruşma
 * sırasında sormak rahatsız eder, ertesi güne bırakmak unutturur.
 *
 * Bildirime dokunmak duruşma çıkışı ekranını açar (data.url, bkz.
 * bildirimVerisi; dinleyici app/_layout.tsx). 09.10.2026'ya kadar bu cümle
 * yazılıydı ama dinleyici yoktu — dokunan avukat uygulamayı en son bıraktığı
 * yerde buluyordu.
 */
export function hearingOutcomeId(hearingId: string): string {
  return planBildirimId('durusma', hearingId, 'sonuc');
}

/**
 * Bildirim metnini üretmek için gereken alanlar. Tip, metni üreten saf modülle
 * AYNI olmak zorunda olduğu için oradan alınır — iki yerde ayrı tanımlanıp
 * ayrışmasınlar.
 */
export type PlanKaynak = BildirimKaynagi;

/**
 * Metin üretimi saf modülde (bkz. utils/bildirimMetni.ts): aynı metin hem kayıt
 * kaydedilirken hem eşitleme sırasında üretiliyor ve iki yol sessizce
 * ayrışmıştı. Burası yalnız çeviri/tarih bağlayıcısıdır.
 */
function planIcerigi(bildirim: PlanliBildirim, kaynak: PlanKaynak): { title: string; body: string } {
  const lang = getLang();
  return bildirimMetni(
    bildirim.etkinlikTuru,
    bildirim.tur,
    kaynak,
    (anahtar, p) => translate(lang, anahtar as Parameters<typeof translate>[1], p as never),
    formatDateTime
  );
}

/**
 * Planlanmış TEK bir bildirimi kurar. Kayıt yolu da eşitleme de buradan geçer:
 * metin, tetik anı işareti (bkz. TETIK_VERI_ANAHTARI) ve dokununca açılacak
 * ekran iki yolda ayrışamaz.
 */
async function bildirimKur(p: PlanliBildirim, kaynak: PlanKaynak): Promise<boolean> {
  const { title, body } = planIcerigi(p, kaynak);
  return Notifications.scheduleNotificationAsync({
    identifier: p.bildirimId,
    content: { title, body, sound: true, data: bildirimVerisi(p) },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(p.tetikMs),
      channelId: CHANNEL_ID,
    },
  }).then(
    () => true,
    () => false
  );
}

const ON_HATIRLATMALAR: readonly BildirimTuru[] = ['secilen', '3g', '1g'];

/**
 * BİR KAYDIN BİLDİRİMLERİNİ KURAR — eşitlemeyle AYNI planla.
 *
 * DÜZELTİLEN KUSUR (09.10.2026 denetimi). Kayıt yolu kendi aşama hesabını
 * yapıyordu (eşitleme ise utils/bildirimPlani'yi kullanıyordu) ve duruşma
 * sonrası sorusu, yeni anı geçmişteyse ESKİSİNİ iptal etmeden dönüyordu:
 * ileri tarihli bir duruşma geçmiş bir tarihe düzeltilince eski "nasıl geçti?"
 * bildirimi kalıyor, yanlış günde çalıyordu. Şimdi önce kaydın istenen
 * türlerdeki TÜM kimlikleri iptal edilir, sonra plandakiler kurulur.
 *
 * Hata yutulur: bildirim kaydın yan etkisidir (bkz. useHearings
 * scheduleFromRow); eksik kalan, ana ekrandaki eşitlemede yeniden kurulur.
 */
async function kaydinBildirimleriniKur(
  etkinlik: PlanEtkinligi,
  kaynak: PlanKaynak,
  turler: readonly BildirimTuru[]
): Promise<void> {
  await Promise.all(
    turler.map((b) =>
      Notifications.cancelScheduledNotificationAsync(planBildirimId(etkinlik.tur, etkinlik.id, b)).catch(() => {})
    )
  );
  for (const p of etkinlikAdaylari(etkinlik, Date.now())) {
    if (turler.includes(p.tur)) await bildirimKur(p, kaynak);
  }
}

export async function scheduleHearingReminder(params: {
  id: string;
  hearingTitle: string;
  /** Kayıt türü (hearing/mediation/deposition…) — bildirim başlığı buna göre yazılır. */
  type?: string;
  scheduledAt: string;
  reminderMinutesBefore: number;
  /** Satırın updated_at'i — seçilen an geçmişteyse yedek hatırlatma buna göre seçilir. */
  kayitISO?: string;
}): Promise<void> {
  await kaydinBildirimleriniKur(
    {
      id: params.id,
      tur: 'durusma',
      anISO: params.scheduledAt,
      secilenDakika: params.reminderMinutesBefore,
      bitti: false,
      kayitISO: params.kayitISO,
    },
    { baslik: params.hearingTitle, anISO: params.scheduledAt, hearingType: params.type },
    ON_HATIRLATMALAR
  );
}

export async function scheduleHearingOutcomePrompt(params: {
  id: string;
  hearingTitle: string;
  type?: string;
  scheduledAt: string;
}): Promise<void> {
  await kaydinBildirimleriniKur(
    { id: params.id, tur: 'durusma', anISO: params.scheduledAt, secilenDakika: 0, bitti: false },
    { baslik: params.hearingTitle, anISO: params.scheduledAt, hearingType: params.type },
    ['sonuc']
  );
}

/** Payment-promise reminder: fires on the morning of the due date + 3d/1d before. */
export async function schedulePromiseReminder(params: {
  id: string;
  /** KULLANILMAZ: müvekkil adı kilit ekranına yazılmaz (bkz. utils/bildirimMetni.ts). */
  clientName?: string;
  amountLabel: string;
  dueDate: string; // yyyy-MM-dd
}): Promise<void> {
  // Vade sabahı 09:00 — useReminderSync ile aynı.
  const anISO = `${params.dueDate}T09:00:00`;
  await kaydinBildirimleriniKur(
    { id: params.id, tur: 'soz', anISO, secilenDakika: 0, bitti: false },
    { baslik: '', tutar: params.amountLabel, anISO },
    ON_HATIRLATMALAR
  );
}

export async function cancelPromiseReminder(promiseId: string): Promise<void> {
  await cancelReminder(promiseReminderId(promiseId));
}

export async function scheduleDeadlineReminder(params: {
  id: string;
  /** KULLANILMAZ: dava adı kilit ekranına yazılmaz (bkz. utils/bildirimMetni.ts). */
  caseTitle?: string;
  deadlineTitle: string;
  dueAt: string;
  reminderMinutesBefore: number;
  /** Satırın updated_at'i — verilmezse yedek hatırlatmayı eşitleme kurar. */
  kayitISO?: string;
}): Promise<void> {
  await kaydinBildirimleriniKur(
    {
      id: params.id,
      tur: 'gorev',
      anISO: params.dueAt,
      secilenDakika: params.reminderMinutesBefore,
      bitti: false,
      kayitISO: params.kayitISO,
    },
    { baslik: params.deadlineTitle, anISO: params.dueAt },
    ON_HATIRLATMALAR
  );
}

// ---------- Plan uygulama: sunucudaki kayıtlardan kendini onaran eşitleme ----------

/**
 * KENDİNİ ONARAN HATIRLATMA EŞİTLEMESİ.
 *
 * Kusur: hatırlatmalar yalnız kayıt oluşturulurken/düzenlenirken, o cihazda
 * kuruluyordu. Yerel bildirim cihaza aittir — uygulama silinip kurulunca,
 * telefon değişince ya da bildirim izni sonradan verilince hepsi yok olur, ama
 * duruşmalar sunucuda durur. Avukat ajandasında duruşmayı görür ve hatırlatma
 * kurulu sanır. Sessiz ve tam kayıp.
 *
 * Bu fonksiyon planı (bkz. utils/bildirimPlani.ts) mevcut durumla KARŞILAŞTIRIR:
 * planda olmayan bizim bildirimlerimizi iptal eder, eksik olanları kurar. Her
 * seferinde hepsini silip yeniden kurmaz — gereksiz yüz kadar yerel çağrıdan
 * kaçınır ve halihazırda doğru kurulmuş bildirime dokunmaz.
 *
 * "Doğru kurulmuş" = anı VE metni plandakiyle aynı (bkz. kuruluBildirimGuncelMi).
 * Başka cihazda değişen saat/başlık/tür ve dil değişikliği burada onarılır.
 */
const BIZIM_ONEKLER = ['hearing-', 'deadline-', 'promise-'] as const;
export type BildirimOneki = (typeof BIZIM_ONEKLER)[number];

/**
 * Planı uygular. Bildirim izni yoksa HİÇBİR ŞEY YAPMAZ — özellikle iptal de
 * etmez: izin verildiğinde (useBildirimIzni değişir) eşitleme yeniden koşup
 * eksiği tamamlar.
 */
export async function syncEtkinlikBildirimleri(
  plan: PlanliBildirim[],
  kaynaklar: Map<string, PlanKaynak>,
  /**
   * YALNIZ VERİSİNE SAHİP OLDUĞUMUZ TÜRLERE DOKUNULUR.
   *
   * DÜZELTİLEN KUSUR (kendi değişikliğimde bulundu). Eşitleme, planda olmayan
   * her bildirimi iptal ediyordu. Ama plan yalnız ELDE VERİSİ OLAN kayıtlardan
   * üretiliyor: ödeme sözleri sorgusu henüz yüklenmemişse ya da kalıcı olarak
   * başarısızsa (payment_promises tablosu hiç kurulmamış olabilir — koddaki
   * isMissingPromiseTable yolu) plan hiç 'promise-' bildirimi içermez ve
   * eşitleme kurulu TÜM ödeme hatırlatmalarını siler. Yükleme sırasında bu
   * gelip geçici bir çırpınma, tablo yoksa KALICI kayıptır.
   *
   * Çağıran taraf artık hangi türlerin verisine sahip olduğunu bildiriyor;
   * bilmediğimiz türe ait bildirimlere dokunulmuyor.
   */
  yonetilenOnekler: readonly BildirimOneki[] = BIZIM_ONEKLER
): Promise<{ kuruldu: number; iptal: number }> {
  if (Platform.OS === 'web') return { kuruldu: 0, iptal: 0 };
  const { status } = await Notifications.getPermissionsAsync();
  izinDurumunuYaz(status === 'granted');
  if (status !== 'granted') return { kuruldu: 0, iptal: 0 };

  const mevcut = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  const bizim = mevcut.filter((n) => yonetilenOnekler.some((p) => n.identifier.startsWith(p)));
  const planda = new Map(plan.map((p) => [p.bildirimId, p]));

  /**
   * SAATİ YA DA METNİ ESKİMİŞ BİLDİRİM DE YENİLENİR.
   *
   * Somut arıza: duruşma A telefonunda 10:00'dan 14:00'e alınıyor, B telefonunda
   * kimlik zaten kurulu olduğu için atlanıyor ve B telefonu hatırlatmayı ESKİ
   * saatte çalıyordu. Bu düzeltme önce yalnız Android'de çalışıyordu: iOS kurulu
   * bildirimin anını geri vermiyor (bkz. TETIK_VERI_ANAHTARI). Aynı cihazdaki
   * düzenleme bu yoldan geçmez (orada iptal-et-yeniden-kur var); bu boşluk çok
   * cihaz, yedekten dönme ve metin kuralı değişikliklerine aitti.
   */
  let iptal = 0;
  const guncel = new Set<string>();
  for (const n of bizim) {
    const p = planda.get(n.identifier);
    const kaynak = p ? kaynaklar.get(p.kaynakId) : undefined;
    if (p && kuruluBildirimGuncelMi(n, { tetikMs: p.tetikMs, ...(kaynak ? planIcerigi(p, kaynak) : {}) })) {
      guncel.add(n.identifier);
      continue;
    }
    // Planda yok, saati kaymış ya da metni değişmiş: iptal; doğrusu aşağıda kurulur.
    await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {});
    iptal++;
  }

  let kuruldu = 0;
  for (const p of plan) {
    if (guncel.has(p.bildirimId)) continue;
    const kaynak = kaynaklar.get(p.kaynakId);
    if (!kaynak) continue;
    if (await bildirimKur(p, kaynak)) kuruldu++;
  }

  return { kuruldu, iptal };
}

/**
 * ÇIKIŞTA TÜM KURULU BİLDİRİMLERİ İPTAL EDER.
 *
 * BULUNAN SIZINTI. Bildirim metinleri duruşma/görev başlığı ve ödeme tutarı
 * taşıyor (müvekkil ve dava ADI 09.10.2026'dan beri yazılmıyor, bkz.
 * utils/bildirimMetni.ts). Bunlar cihazda kurulu yerel bildirimlerdir ve
 * oturumla hiçbir bağları yoktur: avukat çıkış yaptıktan sonra da tetiklenmeye
 * devam ederler. Ortak kullanılan ya da devredilen bir telefonda, bir sonraki
 * kullanıcının kilit ekranında önceki avukatın işi belirir.
 *
 * Yeniden giriş yapıldığında hatırlatmalar zaten sunucudaki kayıtlardan
 * yeniden kuruluyor (useReminderSync), yani iptal etmenin bir bedeli yok.
 */
export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
}

// ---------- Sabah ajanda özeti (morning digest) ----------

const DIGEST_PREFIX = 'digest-';
const DIGEST_HOUR = 7;
const DIGEST_MINUTE = 30;

/** Ajanda etkinliklerini türüne göre kovalara ayırır — hepsine "duruşma" DEME. */
export type DigestBucket = 'durusma' | 'toplanti' | 'kesif' | 'evrak' | 'diger';

/** Kayıt türünü (hearing/mediation/keşif…) özet kovasına eşler. */
export function digestBucket(type?: string | null): DigestBucket {
  switch (type) {
    case 'hearing':
    case 'trial':
      return 'durusma';
    case 'mediation':
    case 'meeting':
      return 'toplanti';
    case 'deposition':
      return 'kesif';
    case 'filing':
      return 'evrak';
    default:
      return 'diger';
  }
}

export interface DigestDay {
  /** YYYY-MM-DD local date key */
  dateKey: string;
  /** Etkinlik sayıları türüne göre (duruşma/toplantı/keşif…). */
  buckets: Record<DigestBucket, number>;
  tasks: number;
  firstEventLabel?: string;
}

/**
 * Schedules a 07:30 local notification for each of the next days that has
 * hearings or tasks. Re-syncing cancels every previous digest first, so the
 * schedule always mirrors the current agenda.
 */
export async function syncMorningDigests(days: DigestDay[]): Promise<void> {
  if (Platform.OS === 'web') return;
  const { status } = await Notifications.getPermissionsAsync();
  izinDurumunuYaz(status === 'granted');
  if (status !== 'granted') return;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(DIGEST_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {}))
  );

  const lang = getLang();
  const BUCKET_ORDER: DigestBucket[] = ['durusma', 'toplanti', 'kesif', 'evrak', 'diger'];
  for (const day of days) {
    const eventTotal = BUCKET_ORDER.reduce((s, b) => s + (day.buckets[b] ?? 0), 0);
    if (eventTotal === 0 && day.tasks === 0) continue;
    const [y, m, d] = day.dateKey.split('-').map(Number);
    const triggerAt = new Date(y, m - 1, d, DIGEST_HOUR, DIGEST_MINUTE, 0, 0);
    if (triggerAt.getTime() <= Date.now()) continue;

    const parts: string[] = [];
    // Her tür kendi doğru adıyla sayılır: "2 duruşma, 1 toplantı" gibi.
    for (const b of BUCKET_ORDER) {
      const n = day.buckets[b] ?? 0;
      if (n > 0) parts.push(translate(lang, `digest.${b}` as Parameters<typeof translate>[1], { n }));
    }
    if (day.tasks > 0) parts.push(translate(lang, 'digest.tasks', { n: day.tasks }));
    let body = parts.join(', ');
    if (day.firstEventLabel) body += `\n${translate(lang, 'digest.first', { label: day.firstEventLabel })}`;

    await Notifications.scheduleNotificationAsync({
      identifier: `${DIGEST_PREFIX}${day.dateKey}`,
      content: { title: translate(lang, 'digest.title'), body, sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerAt,
        channelId: CHANNEL_ID,
      },
    }).catch(() => {});
  }
}
