/**
 * BAŞARISIZ İSTEKTE HAK İADESİ (08.10.2026).
 *
 * BULUNAN KUSUR. ai-chat hakkı istek BAŞLAMADAN ayırıyor (deneme hakkı:
 * deneme_hakki_rezerve_et; AI paketi: ai_mod_rezerve_et). Geri verme yalnız
 * BAŞARILI yolda vardı (yedek model cevapladıysa ya da çıktı kusurluysa).
 * Servis hata verdiğinde ('upstream' 502), model boş döndüğünde ('empty'
 * 502), sağlayıcı sınırına takılınca (429) ya da istek çöktüğünde avukat
 * HİÇBİR CEVAP almadığı hâlde hakkı gidiyordu — altı modun altısında da.
 * 08.10'da Claude Console hesabı askıya alındı; yedek de düşerse her deneme
 * bir hak yakacaktı. Kodun kendi ilkesi: "hakkı yenen kullanıcı ürüne bir
 * daha güvenmez".
 *
 * ÇÖZÜM TEK YERDE. Her dönüş yoluna ayrı ayrı iade eklemek, bir sonraki yeni
 * yolda yine unutulurdu. İstek, ayırma bilgisini taşıyan bir kayıtla
 * sarmalanır: cevap 2xx değilse ya da istek fırlatırsa ayrılan ne varsa geri
 * verilir. Başarılı yoldaki mevcut iadeler (yedek/kusurlu) 2xx döndüğü için
 * burada İKİNCİ KEZ iade edilmez.
 */
export interface HakRezervasyonu {
  userId: string;
  /** Deneme hakkından bir soru ayrıldı mı? */
  deneme: boolean;
  /** AI paketinin aylık kotasından ayrılan (ay + mütalaa mı). */
  mod: null | { ay: string; mutalaa: boolean };
}

export interface IadeIslemleri {
  deneme: (userId: string) => Promise<void>;
  mod: (userId: string, ay: string, mutalaa: boolean) => Promise<void>;
}

export function yeniRezervasyon(): HakRezervasyonu {
  return { userId: '', deneme: false, mod: null };
}

/** Ayrılmış ne varsa geri verir; kayıt sıfırlanır, ikinci çağrı bir şey yapmaz. */
export async function rezervasyonuIadeEt(r: HakRezervasyonu, islem: IadeIslemleri): Promise<void> {
  if (!r.userId) return;
  const { userId, deneme, mod } = r;
  r.deneme = false;
  r.mod = null;
  if (deneme) await islem.deneme(userId);
  if (mod) await islem.mod(userId, mod.ay, mod.mutalaa);
}

/** İsteği çalıştırır; başarısız biterse (2xx dışı ya da hata) hakkı iade eder. */
export async function basarisizsaIadeEt(
  r: HakRezervasyonu,
  isle: () => Promise<Response>,
  islem: IadeIslemleri,
): Promise<Response> {
  try {
    const yanit = await isle();
    if (!yanit.ok) await rezervasyonuIadeEt(r, islem);
    return yanit;
  } catch (e) {
    await rezervasyonuIadeEt(r, islem);
    throw e;
  }
}
