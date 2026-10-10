/**
 * BİLDİRİM PLANI — hangi hatırlatma kurulacak, hangisi bütçeye sığmayacak.
 *
 * BULUNAN İKİ KUSUR.
 *
 * 1) iOS'ta bir uygulamanın kurabileceği BEKLEYEN yerel bildirim sayısı 64 ile
 *    sınırlıdır ve fazlası SESSİZCE düşer — ne uygulama hata alır, ne kullanıcı
 *    bir şey görür. Bu uygulamada duruşma başına 3-4 bildirim kuruluyor
 *    (seçilen hatırlatma + 3 gün kala + 1 gün kala + duruşma sonrası "ne
 *    oldu?"), göreve 3, ödeme sözüne 3, üstüne bir haftalık sabah özeti.
 *    Kodun kendi yorumundaki GERÇEK VERİ 49 duruşmadan söz ediyor: 49 duruşma
 *    tek başına ~150 bildirim eder. Yani tavanın iki katından fazlası kurulmaya
 *    çalışılıyor ve büyük kısmı hiç kurulmuyordu.
 *
 *    Hangi 64'ün tutulduğu konusunda kaynaklar AYNI ŞEYİ SÖYLEMİYOR (bazıları
 *    "en yakın tarihli 64", bazıları "en son kurulan 64" diyor). Bu belirsizlik
 *    tek başına yeterli sebeptir: doğru davranış tavana yaslanmak değil,
 *    TAVANIN ALTINDA KALMAKTIR. Sığmayacak olanı biz seçersek en yakın duruşma
 *    her zaman korunur; işletim sistemine bırakırsak yarınki duruşmanın
 *    hatırlatması, üç ay sonraki bir görevin "3 gün kala" bildirimi uğruna
 *    düşebilir.
 *
 *    NOT (dürüstlük): 64 sınırı Apple'ın belgelenmiş platform sınırıdır,
 *    kaynaklardan okundu — bu oturumda GERÇEK BİR iPhone'da ÖLÇÜLMEDİ. Aşağıdaki
 *    seçim mantığı ise saf fonksiyondur ve testlerle ölçülür.
 *
 * 2) Hatırlatmalar YALNIZ kayıt oluşturulurken/düzenlenirken, o cihazda
 *    kuruluyordu. Yerel bildirim cihaza aittir: uygulama silinip kurulunca,
 *    telefon değişince ya da bildirim izni sonradan verilince kurulu bildirimler
 *    yok olur — ama duruşmalar sunucuda durmaya devam eder. Avukat ajandasında
 *    duruşmayı görür ve hatırlatmanın kurulu olduğunu sanır. Sessiz ve tam
 *    kayıp. Bu dosya, "sunucudaki kayıtlardan planı yeniden üret" işinin saf
 *    yarısıdır; bunu her açılışta çalıştıran taraf useReminderSync'tir.
 *
 * NEDEN AYRI VE SAF DOSYA. Seçim mantığı `expo-notifications`in içine gömülü
 * olsaydı test edilemezdi (test koşucusu react-native'i ayrıştıramıyor). Burada
 * girdi düz veri, çıktı düz veri; davranış testlere bağlanabiliyor.
 */

/** iOS'un uygulama başına bekleyen bildirim tavanı (Apple platform sınırı). */
export const IOS_BILDIRIM_TAVANI = 64;

/** syncMorningDigests en fazla bir haftalık sabah özeti kurar. */
export const SABAH_OZETI_PAYI = 7;

/**
 * Tavana yaslanmıyoruz. Kalan pay, uygulamanın ileride kuracağı bildirimler ve
 * işletim sisteminin kendi saydığı uçlar için güvenlik boşluğudur.
 */
export const GUVENLIK_PAYI = 7;

/** Etkinlik hatırlatmalarına ayrılan bütçe. */
export const BILDIRIM_BUTCESI = IOS_BILDIRIM_TAVANI - SABAH_OZETI_PAYI - GUVENLIK_PAYI;

const DAKIKA_MS = 60_000;
const GUN_DAKIKA = 24 * 60;

/** Duruşmadan kaç dakika sonra "ne oldu?" diye sorulacağı (notifications.ts ile aynı). */
export const SONUC_GECIKME_DAKIKA = 120;

export type EtkinlikTuru = 'durusma' | 'gorev' | 'soz';

export interface PlanEtkinligi {
  /** Kaydın kimliği (duruşma/görev/söz id'si). */
  id: string;
  tur: EtkinlikTuru;
  /** Etkinlik anı (ISO). Ödeme sözünde vade sabahı. */
  anISO: string;
  /** Kullanıcının seçtiği hatırlatma önceliği (dakika). Sözde 0. */
  secilenDakika: number;
  /** Tamamlandı/ödendi ise hiç hatırlatma kurulmaz. */
  bitti: boolean;
  /**
   * Kaydın son kaydedildiği an (satırın `updated_at`'i). Yalnız yedek
   * hatırlatmayı seçmek için kullanılır (bkz. YEDEK_ONCELIK_DAKIKA);
   * verilmezse yedek kurulmaz.
   */
  kayitISO?: string;
}

/**
 * SEÇİLEN HATIRLATMA KAYIT ANINDA ZATEN GEÇMİŞTEYSE — YEDEK.
 *
 * DÜZELTİLEN KUSUR (09.10.2026 denetimi, kodla doğrulandı). Duruşma formunun
 * varsayılanı "yarın bu saat" + "1 gün önce" (app/hearing-form.tsx): seçilen
 * an formun açıldığı ana denk geliyor ve kaydedildiğinde geçmişte kalıyordu;
 * "3 gün kala" da geçmişte, "1 gün kala" seçilenle aynı. Yani varsayılanlarla
 * girilen duruşmaya HİÇ ön hatırlatma kurulmuyordu. Akşam girilen ertesi sabah
 * duruşması da aynı durumdaydı.
 *
 * Kural: kayıt anında hiçbir ön hatırlatma (seçilen, 3 gün, 1 gün) ileride
 * kalmıyorsa ve etkinlik hâlâ ilerideyse, formdaki seçeneklerden etkinliğe
 * en uzak olup kayıt anından SONRAYA düşen kullanılır: 1 saat, o da geçmişse
 * 30 dakika. İkisi de geçmişse kurulmaz.
 *
 * NEDEN "şimdi"ye DEĞİL KAYIT ANINA göre: plan her eşitlemede yeniden
 * üretiliyor. "Şimdi"ye göre seçilseydi 1 saat kala bildirimi çaldıktan sonraki
 * ilk eşitleme 30 dk kala için İKİNCİ bir bildirim kurardı. Kayıt anı sabit
 * olduğu için plan zamanla kaymaz.
 *
 * Ödeme sözünde uygulanmaz: orada "an" vade sabahıdır ve öncelik 0'dır.
 */
export const YEDEK_ONCELIK_DAKIKA = [60, 30] as const;

export type BildirimTuru = 'secilen' | '3g' | '1g' | 'sonuc';

export interface PlanliBildirim {
  /** Bildirim kimliği — notifications.ts'teki id şemasıyla birebir aynı. */
  bildirimId: string;
  kaynakId: string;
  etkinlikTuru: EtkinlikTuru;
  tur: BildirimTuru;
  /** Tetikleneceği an (ms). */
  tetikMs: number;
}

/**
 * Aşama son ekleri. notifications.ts hem kurarken hem iptal ederken bu ekleri
 * kullanır; üç yerde ayrı ayrı yazılmasınlar diye buradan okunuyorlar. Ek bir
 * yerde değişip diğerinde kalsaydı, iptal ettiğini sanan kod aslında hiçbir
 * şeyi iptal etmemiş olurdu — ve bu hiçbir hata üretmezdi.
 */
export const EK_3_GUN = '-3d';
export const EK_1_GUN = '-1d';

/** Bildirim kimliği şemasının TEK sahibi. notifications.ts buraya sorar. */
export function planBildirimId(tur: EtkinlikTuru, kaynakId: string, bildirim: BildirimTuru): string {
  const taban =
    tur === 'durusma' ? `hearing-${kaynakId}` : tur === 'gorev' ? `deadline-${kaynakId}` : `promise-${kaynakId}`;
  if (bildirim === 'sonuc') return `hearing-outcome-${kaynakId}`;
  if (bildirim === '3g') return `${taban}${EK_3_GUN}`;
  if (bildirim === '1g') return `${taban}${EK_1_GUN}`;
  return taban;
}

/**
 * Bir etkinliğin ADAY bildirimleri: seçilen öncelik + 3 gün kala + 1 gün kala,
 * duruşmalarda ayrıca duruşma sonrası soru.
 *
 * Aynı ana denk gelen aşamalar teke iner (kullanıcı "1 gün önce" seçtiyse
 * "1 gün kala" bildirimi ikinci kez kurulmaz) ve geçmişte kalanlar atılır.
 */
export function etkinlikAdaylari(etkinlik: PlanEtkinligi, simdiMs: number): PlanliBildirim[] {
  if (etkinlik.bitti) return [];
  const anMs = new Date(etkinlik.anISO).getTime();
  if (!Number.isFinite(anMs)) return [];

  const asamalar: { tur: BildirimTuru; dakika: number }[] = [
    { tur: 'secilen', dakika: etkinlik.secilenDakika },
    { tur: '3g', dakika: 3 * GUN_DAKIKA },
    { tur: '1g', dakika: 1 * GUN_DAKIKA },
  ];

  // Yedek: bkz. YEDEK_ONCELIK_DAKIKA. Kayıt anına göre seçilir, şimdiye göre değil.
  const kayitMs = etkinlik.kayitISO ? new Date(etkinlik.kayitISO).getTime() : NaN;
  if (etkinlik.tur !== 'soz' && Number.isFinite(kayitMs) && anMs > kayitMs) {
    const kayittanSonra = (dakika: number) => anMs - dakika * DAKIKA_MS > kayitMs;
    if (!asamalar.some((a) => kayittanSonra(a.dakika))) {
      const yedek = YEDEK_ONCELIK_DAKIKA.find(kayittanSonra);
      if (yedek !== undefined) asamalar[0] = { tur: 'secilen', dakika: yedek };
    }
  }

  const adaylar: PlanliBildirim[] = [];
  const gorulenDakika = new Set<number>();
  for (const asama of asamalar) {
    if (gorulenDakika.has(asama.dakika)) continue;
    gorulenDakika.add(asama.dakika);
    const tetikMs = anMs - asama.dakika * DAKIKA_MS;
    if (tetikMs <= simdiMs) continue;
    adaylar.push({
      bildirimId: planBildirimId(etkinlik.tur, etkinlik.id, asama.tur),
      kaynakId: etkinlik.id,
      etkinlikTuru: etkinlik.tur,
      tur: asama.tur,
      tetikMs,
    });
  }

  // Duruşma sonrası "ne oldu?" — süre kaydının tek tetikleyicisi.
  if (etkinlik.tur === 'durusma') {
    const sonucMs = anMs + SONUC_GECIKME_DAKIKA * DAKIKA_MS;
    if (sonucMs > simdiMs) {
      adaylar.push({
        bildirimId: planBildirimId('durusma', etkinlik.id, 'sonuc'),
        kaynakId: etkinlik.id,
        etkinlikTuru: 'durusma',
        tur: 'sonuc',
        tetikMs: sonucMs,
      });
    }
  }

  return adaylar;
}

/**
 * KURULU BİR BİLDİRİMİN TETİKLENME ANINI ÇÖZER.
 *
 * DÜZELTİLEN EKSİK. Eşitleme yalnız "kimlik kurulu mu?" diye bakıyordu; kurulu
 * olan bir bildirimin SAATİ yanlış olsa bile ona dokunmuyordu. Somut arıza:
 * avukat duruşmayı A telefonunda 10:00'dan 14:00'e alıyor, B telefonunda
 * `hearing-<id>` zaten kurulu olduğu için eşitleme onu atlıyor ve B telefonu
 * hatırlatmayı ESKİ saatte çalıyor. Duruşma bir ay ertelendiyse B telefonu bir
 * ay erken çalıp bir daha hiç çalmıyor.
 *
 * (Aynı cihazda yapılan düzenleme bu yoldan geçmez — orada iptal-et-yeniden-kur
 * zaten çalışıyor. Bu boşluk çok cihaz ve yedekten dönme durumlarına aitti;
 * yani "telefon değişince onarır" iddiasının eksik kalan yarısı.)
 *
 * ÇÖZÜLEMEZSE null DÖNER ve çağıran taraf bildirime DOKUNMAZ: platformun
 * anlamadığımız bir tetikleyici biçimi yüzünden her eşitlemede her bildirimi
 * silip yeniden kurmak, sessiz bir israf döngüsü olurdu.
 */
export function tetikAniCoz(tetikleyici: unknown): number | null {
  if (!tetikleyici || typeof tetikleyici !== 'object') return null;
  const t = tetikleyici as Record<string, unknown>;

  // Yaygın biçim: { type: 'date', date: Date | number }
  const d = t.date ?? t.value;
  if (d instanceof Date) {
    const ms = d.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof d === 'number' && Number.isFinite(d)) return d;

  // iOS takvim tetikleyicisi: { type: 'calendar', dateComponents: {...} }
  const bilesen = t.dateComponents;
  if (bilesen && typeof bilesen === 'object') {
    const c = bilesen as Record<string, unknown>;
    const say = (k: string) => (typeof c[k] === 'number' ? (c[k] as number) : null);
    const yil = say('year');
    const ay = say('month');
    const gun = say('day');
    if (yil !== null && ay !== null && gun !== null) {
      const ms = new Date(yil, ay - 1, gun, say('hour') ?? 0, say('minute') ?? 0, say('second') ?? 0).getTime();
      return Number.isFinite(ms) ? ms : null;
    }
  }

  return null;
}

/**
 * Kurulu bildirim, planlanan anla aynı sayılır mı?
 *
 * Tolerans var çünkü bazı platformlar tetikleme anını saniyeye/dakikaya
 * yuvarlar; toleranssız bir karşılaştırma her eşitlemede "farklı" deyip
 * bildirimleri boş yere yeniden kurardı.
 */
export const TETIK_TOLERANS_MS = 60_000;

export function tetikGuncelMi(mevcutTetikleyici: unknown, planlananMs: number): boolean {
  const mevcutMs = tetikAniCoz(mevcutTetikleyici);
  if (mevcutMs !== null) return Math.abs(mevcutMs - planlananMs) <= TETIK_TOLERANS_MS;
  // iOS'ta bizim 'date' bildirimimiz böyle geri okunur (bkz. TETIK_VERI_ANAHTARI)
  // ve anı bu biçimden hesaplanamaz. Tek seferlik aralığı biz kurmadık; bu
  // ancak eski sürümde, işaretsiz kurulmuş bir bildirim olabilir → bir kez
  // yeniden kurulur. Yeni kurulan işaret taşıdığı için döngü olmaz.
  if (tetikleyiciTuru(mevcutTetikleyici) === 'timeInterval' && !tekrarlarMi(mevcutTetikleyici)) return false;
  return true; // tanımadığımız biçim: dokunma
}

function tetikleyiciTuru(t: unknown): unknown {
  return t && typeof t === 'object' ? (t as Record<string, unknown>).type : undefined;
}

function tekrarlarMi(t: unknown): boolean {
  return !!t && typeof t === 'object' && (t as Record<string, unknown>).repeats === true;
}

/**
 * KURULU BİLDİRİMİN İÇİNE YAZILAN TETİK ANI.
 *
 * DÜZELTİLEN KUSUR (09.10.2026 denetimi, kodla doğrulandı). Yukarıdaki "saati
 * eskimiş bildirim de yenilenir" düzeltmesi iOS'ta HİÇ çalışmıyordu:
 * expo-notifications iOS'ta 'date' tetikleyicisini kurarken
 * UNTimeIntervalNotificationTrigger'a çeviriyor (ios/.../TriggerRecords.swift,
 * DateTriggerRecord) ve geri okurken { type: 'timeInterval', seconds } veriyor
 * (NotificationRecords.swift). `seconds` KURULDUĞU andaki aralıktır; kurulma
 * anı bilinmediğinden tetik anı ondan çıkarılamaz. tetikAniCoz null dönüyor,
 * eşitleme "çözemedim → dokunma" diyordu: başka cihazda saati değiştirilen
 * duruşmanın iPhone'daki hatırlatması ESKİ saatte çalıyordu.
 *
 * Çözüm: kurulan her bildirimin content.data'sına planlanan an yazılır. İki
 * platform da data'yı aynen geri veriyor (iOS userInfo; Android gövde JSON'u,
 * JS tarafında `data`'ya açılıyor — expo-notifications kaynağından okundu,
 * cihazda ölçülmedi).
 */
export const TETIK_VERI_ANAHTARI = 'tetikMs';

/** getAllScheduledNotificationsAsync'in döndürdüğü isteğin bize gereken kısmı. */
export interface KuruluBildirim {
  trigger?: unknown;
  content?: { title?: unknown; body?: unknown; data?: unknown } | null;
}

/**
 * BİLDİRİME DOKUNULUNCA AÇILAN EKRAN.
 *
 * DÜZELTİLEN KUSUR (09.10.2026 denetimi). notifications.ts "Bildirime dokunmak
 * duruşma çıkışı ekranını açar" diyordu; uygulamada bildirim yanıtını dinleyen
 * HİÇBİR kod yoktu, bildirim de hedef taşımıyordu. "Süre verildiyse şimdi
 * kaydedin" diyen bildirime dokunan avukat, uygulamayı en son nerede
 * bıraktıysa oraya düşüyordu.
 *
 * Yalnız BİLİNEN yollar açılır: sunucudan gelen bir bildirimin (push) data'sı
 * bizim elimizde değil; oradan gelen rastgele bir yol açılmaz.
 */
export const HEDEF_VERI_ANAHTARI = 'url';
export const SONUC_EKRANI = '/durusma-cikisi';

/** Kurulan bildirimin content.data'sı: eşitleme için tetik anı + dokununca açılacak ekran. */
export function bildirimVerisi(p: PlanliBildirim): Record<string, string | number> {
  const veri: Record<string, string | number> = { [TETIK_VERI_ANAHTARI]: p.tetikMs };
  if (p.tur === 'sonuc') veri[HEDEF_VERI_ANAHTARI] = SONUC_EKRANI;
  return veri;
}

export function bildirimHedefi(veri: unknown): string | null {
  if (!veri || typeof veri !== 'object') return null;
  const yol = (veri as Record<string, unknown>)[HEDEF_VERI_ANAHTARI];
  return yol === SONUC_EKRANI ? SONUC_EKRANI : null;
}

function tetikIsareti(kurulu: KuruluBildirim): number | null {
  const veri = kurulu.content?.data;
  if (!veri || typeof veri !== 'object') return null;
  const ms = (veri as Record<string, unknown>)[TETIK_VERI_ANAHTARI];
  return typeof ms === 'number' && Number.isFinite(ms) ? ms : null;
}

/**
 * Kurulu bildirim plandakiyle AYNI mı — anı ve metni?
 *
 * METİN DE KARŞILAŞTIRILIR. Eşitleme önceden yalnız anı kontrol ediyordu;
 * başka cihazda değişen duruşma başlığı/türü, dil değişikliği ya da bildirim
 * metni kuralındaki bir değişiklik (ör. kilit ekranına müvekkil adı yazmama)
 * önceden kurulmuş bildirimlere HİÇ yansımıyordu — eski metin, kayıt yeniden
 * düzenlenene kadar çalmaya devam ediyordu. Platform metni okuyamazsa (string
 * değilse) metin yüzünden yeniden kurulmaz; döngü olmasın.
 */
export function kuruluBildirimGuncelMi(
  kurulu: KuruluBildirim,
  plan: { tetikMs: number; title?: string; body?: string }
): boolean {
  const icerik = kurulu.content;
  if (plan.title !== undefined && typeof icerik?.title === 'string' && icerik.title !== plan.title) return false;
  if (plan.body !== undefined && typeof icerik?.body === 'string' && icerik.body !== plan.body) return false;

  const isaret = tetikIsareti(kurulu);
  if (isaret !== null) return Math.abs(isaret - plan.tetikMs) <= TETIK_TOLERANS_MS;
  return tetikGuncelMi(kurulu.trigger, plan.tetikMs);
}

/**
 * Tüm etkinliklerin bildirimlerini üretir, EN YAKIN TARİHLİ ÖNCE olacak şekilde
 * sıralar ve bütçeye sığanı döndürür.
 *
 * Sıralamanın "tetiklenme anına göre" olması kasıtlıdır: yarınki duruşmanın
 * hatırlatması, üç ay sonraki bir görevin bildiriminden her zaman önce gelir.
 * Böylece bütçe dolduğunda düşen şey HER ZAMAN en uzaktaki olur — sessizce
 * düşenin ne olduğunu işletim sistemine bırakmayız.
 */
export function bildirimPlaniYap(
  etkinlikler: PlanEtkinligi[],
  simdiMs: number,
  butce: number = BILDIRIM_BUTCESI
): { plan: PlanliBildirim[]; sigmayan: number } {
  const adaylar: PlanliBildirim[] = [];
  for (const e of etkinlikler) adaylar.push(...etkinlikAdaylari(e, simdiMs));

  adaylar.sort((a, b) => a.tetikMs - b.tetikMs || a.bildirimId.localeCompare(b.bildirimId));

  const sinir = Math.max(0, butce);
  return { plan: adaylar.slice(0, sinir), sigmayan: Math.max(0, adaylar.length - sinir) };
}
