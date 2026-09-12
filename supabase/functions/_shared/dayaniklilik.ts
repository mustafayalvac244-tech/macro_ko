// DIŞ KAYNAĞA DAYANIKLI ERİŞİM — zaman aşımı + devre kesici.
//
// NEDEN VAR. UYAP/Bedesten bir KAMU hizmeti ve bugün canlı ölçümde şunu
// gördüm: aynı arama bir denemede TLS el sıkışmasında düştü, ikinci denemede
// ancak dört tekrardan sonra geldi — geçen süre 34,86 saniye. Sağlıklıyken
// aynı arama 1,08 saniye sürüyor. Yani kaynak ÇOĞU ZAMAN hızlı, BAZEN ölü.
//
// Bu fark, arka planda zararsızdı: hasat turu bir tur gecikir, kimse görmez.
// Ama kullanıcının yapay zekâ isteğine bağlarsak, kaynak takıldığında AVUKATIN
// CEVABI takılır. Bir hukuk uygulamasında bu, eksik içtihattan daha kötüdür.
//
// İKİ KORUMA:
//
// 1. SIKI ZAMAN AŞIMI. Yavaş yanıt = yanıt yok. Tekrar denemek YOK — tekrar,
//    bekleyen kullanıcının süresini katlar. (Arka plan hasadında tekrar
//    mantıklıdır; burada değil. Aynı kodu iki yerde kullanmamamızın sebebi bu.)
//
// 2. DEVRE KESİCİ. Kaynak ölüyse her istekte yeniden zaman aşımı beklemek,
//    her isteğe o gecikmeyi EKLEMEK demektir. Üst üste N hata sonrası devre
//    AÇILIR ve bir süre hiç denenmez; süre dolunca TEK bir yoklama isteği
//    gönderilir (yarım açık). Başarılıysa devre kapanır.
//
// Saat dışarıdan verilebiliyor: testin gerçek zamana bağlı kalması, testi
// yavaş ve kırılgan yapardı.

export interface ZamanAsimiSecenek {
  /** Milisaniye. Aşılırsa iş iptal edilir ve hata atılır. */
  ms: number;
  /** Hata mesajında görünecek ad — hangi çağrının düştüğü anlaşılsın. */
  ad?: string;
}

/**
 * İşi verilen süre içinde bitmezse iptal eder.
 *
 * İşe bir AbortSignal geçiriliyor: `fetch` bunu aldığında isteği GERÇEKTEN
 * keser. Sinyal geçirilmezse süre dolduğunda yalnız beklemeyi bırakırdık,
 * istek arka planda sürer ve kaynağa yük bindirmeye devam ederdi.
 */
export async function zamanAsimiyla<T>(
  is: (sinyal: AbortSignal) => Promise<T>,
  { ms, ad = 'istek' }: ZamanAsimiSecenek
): Promise<T> {
  const kontrol = new AbortController();
  let zamanlayici: ReturnType<typeof setTimeout> | undefined;
  const saat = new Promise<never>((_, red) => {
    zamanlayici = setTimeout(() => {
      kontrol.abort();
      red(new Error(`${ad}: ${ms} ms zaman aşımı`));
    }, ms);
  });
  try {
    return await Promise.race([is(kontrol.signal), saat]);
  } finally {
    if (zamanlayici !== undefined) clearTimeout(zamanlayici);
  }
}

export type DevreDurum = 'kapali' | 'acik' | 'yarim';

export interface DevreSecenek {
  /** Kaç ardışık hatadan sonra devre açılsın. */
  esik?: number;
  /** Devre açık kaldıktan sonra kaç ms sonra yoklama yapılsın. */
  acikKalmaMs?: number;
  /** Test için saat. Varsayılan Date.now. */
  saat?: () => number;
}

/**
 * DEVRE KESİCİ.
 *
 * 'kapali' = normal, istekler geçer.
 * 'acik'   = kaynak ölü sayılıyor, istek HİÇ denenmez (anında "yok" döner).
 * 'yarim'  = süre doldu, TEK bir yoklama isteğine izin var.
 */
export class DevreKesici {
  private hata = 0;
  private acildi = 0;
  private yoklamaVerildi = false;
  private readonly esik: number;
  private readonly acikKalmaMs: number;
  private readonly saat: () => number;

  constructor({ esik = 3, acikKalmaMs = 60_000, saat = () => Date.now() }: DevreSecenek = {}) {
    this.esik = Math.max(1, esik);
    this.acikKalmaMs = Math.max(0, acikKalmaMs);
    this.saat = saat;
  }

  durum(): DevreDurum {
    if (this.hata < this.esik) return 'kapali';
    if (this.saat() - this.acildi >= this.acikKalmaMs) return 'yarim';
    return 'acik';
  }

  /**
   * İstek denensin mi? 'yarim' durumunda YALNIZ BİR çağrıya true döner —
   * yoksa devre açıkken biriken tüm istekler aynı anda ölü kaynağa gider ve
   * hepsi zaman aşımı bekler; korumanın amacı boşa çıkardı.
   */
  gecebilirMi(): boolean {
    const d = this.durum();
    if (d === 'kapali') return true;
    if (d === 'acik') return false;
    if (this.yoklamaVerildi) return false;
    this.yoklamaVerildi = true;
    return true;
  }

  basarili(): void {
    this.hata = 0;
    this.acildi = 0;
    this.yoklamaVerildi = false;
  }

  basarisiz(): void {
    this.hata++;
    if (this.hata >= this.esik) {
      this.acildi = this.saat();
      this.yoklamaVerildi = false;
    }
  }

  /** Teşhis için: kaç ardışık hata var. */
  hataSayisi(): number {
    return this.hata;
  }
}

/**
 * Devre kesici + zaman aşımı birlikte. Hata ATMAZ, `yedek` döner.
 *
 * Çağıran tarafın try/catch yazmasını beklemek, er ya da geç birinin
 * yazmamasına ve kullanıcının cevabının bir dış servisin arızasıyla birlikte
 * düşmesine yol açar. Bu yüzden imza hatasızdır: en kötü hâlde `yedek`.
 */
export async function korumaliGetir<T>(
  devre: DevreKesici,
  is: (sinyal: AbortSignal) => Promise<T>,
  secenek: ZamanAsimiSecenek,
  yedek: T
): Promise<T> {
  if (!devre.gecebilirMi()) return yedek;
  try {
    const sonuc = await zamanAsimiyla(is, secenek);
    devre.basarili();
    return sonuc;
  } catch {
    devre.basarisiz();
    return yedek;
  }
}
