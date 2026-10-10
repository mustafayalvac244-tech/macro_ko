/**
 * YAPAY ZEKÂYA GİDEN METİNDE KİŞİ ADLARINI ROLE ÇEVİRME.
 *
 * Neden var (10.10.2026, 50 denetçi bulgusu): duruşma brifi isteminde
 * müvekkilin ve karşı tarafın gerçek adı yapay zekâ sunucusuna gidiyordu. Brif
 * metninin ihtiyacı ad değil roldür ("Müvekkil", "Karşı taraf"); avukat gerçek
 * adı çıktıya kendisi yazar. Ad gerekmediği için gönderilmez.
 *
 * KAPSAM (dürüst sınır): bu bir anonimleştirme GARANTİSİ DEĞİL. Yalnız dosyada
 * kayıtlı ad/şirket adını ve (kişi adlarında) ad-soyad parçalarını değiştirir;
 * serbest metne yazılmış üçüncü kişi adları, yazım varyantları ya da eke bitişik
 * yazımlar ("Ahmetin") kalabilir. 11 haneli sayılar (TC kimlik no biçimi)
 * ayrıca gizlenir. Saf fonksiyon: ağ ve platform bağımlılığı yok.
 */

export interface RolEslemesi {
  ad: string | null | undefined;
  rol: string;
  /** Kişi adıysa ad-soyad parçaları da (tek başına geçtiğinde) değiştirilir. */
  parcalar?: boolean;
}

const KATLA: Record<string, string> = {
  ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ı: 'i', İ: 'i', I: 'i', ö: 'o', Ö: 'o',
  ş: 's', Ş: 's', ü: 'u', Ü: 'u', â: 'a', Â: 'a', î: 'i', Î: 'i', û: 'u', Û: 'u',
};

/** Şirket eki gibi ad sayılmayacak parçalar (katlanmış biçimde). */
const ATLANAN_PARCA = new Set(['ltd', 'sti', 'tic', 'san', 'anonim', 'limited', 'sirketi', 'sirket', 'ticaret', 'sanayi']);

/**
 * Büyük/küçük ve Türkçe harf farkını eşitler; UZUNLUĞU KORUR (her kod birimi
 * bir kod birimine) ki bulunan konum özgün metinde de aynı yeri göstersin.
 * `toLowerCase` bu yüzden doğrudan kullanılmaz: 'İ'.toLowerCase() iki birime açılır.
 */
function katla(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    const k = KATLA[c];
    if (k) {
      out += k;
      continue;
    }
    const alt = c.toLowerCase();
    out += alt.length === 1 ? alt : c;
  }
  return out;
}

const harfMi = (c: string | undefined) => !!c && /[\p{L}\p{N}]/u.test(c);

interface Kalip {
  n: string;
  rol: string;
}

function kaliplariKur(adlar: RolEslemesi[]): Kalip[] {
  const tam: Kalip[] = [];
  const parca = new Map<string, Set<string>>();

  for (const { ad, rol, parcalar } of adlar) {
    const temiz = (ad ?? '').trim().replace(/\s+/g, ' ');
    if (!temiz) continue;
    tam.push({ n: katla(temiz), rol });
    if (!parcalar) continue;
    for (const ham of temiz.split(' ')) {
      const p = katla(ham.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''));
      if (p.length < 3 || /^\d+$/.test(p) || ATLANAN_PARCA.has(p)) continue;
      (parca.get(p) ?? parca.set(p, new Set()).get(p)!).add(rol);
    }
  }

  // Aynı parça iki rolde de geçiyorsa (ör. aynı soyad) hangisi olduğu bilinmez → yansız söz.
  const parcaKaliplari: Kalip[] = [...parca.entries()].map(([n, roller]) => ({
    n,
    rol: roller.size === 1 ? [...roller][0]! : 'taraf',
  }));

  // Uzun kalıp önce: "Ahmet Yılmaz", "Yılmaz"dan önce eşleşsin.
  return [...tam, ...parcaKaliplari].filter((k) => k.n).sort((a, b) => b.n.length - a.n.length);
}

/** Metindeki kayıtlı adları rol sözcüğüyle değiştirir. Eşleşme tam sözcük ister. */
export function adlariRolleCevir(metin: string, adlar: RolEslemesi[]): string {
  const kaliplar = kaliplariKur(adlar);
  if (!metin || kaliplar.length === 0) return metin;

  const katli = katla(metin);
  let out = '';
  let i = 0;
  while (i < metin.length) {
    let eslesen: Kalip | null = null;
    if (!harfMi(katli[i - 1])) {
      for (const k of kaliplar) {
        if (katli.startsWith(k.n, i) && !harfMi(katli[i + k.n.length])) {
          eslesen = k;
          break;
        }
      }
    }
    if (eslesen) {
      out += eslesen.rol;
      i += eslesen.n.length;
    } else {
      out += metin[i];
      i++;
    }
  }
  return out;
}

/** 11 haneli sayıları (TC kimlik no biçimi) gizler. Tutarlar noktalı yazıldığı için etkilenmez. */
export function kimlikNumarasiniGizle(metin: string): string {
  return metin.replace(/(?<!\d)[1-9]\d{10}(?!\d)/g, 'kimlik no');
}
