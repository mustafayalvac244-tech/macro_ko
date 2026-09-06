// DOSYA KÜNYESİ DOĞRULAMA — belgeden okunan alan gerçekten belgede var mı?
// ---------------------------------------------------------------------------
// NEDEN. Dosya aktarma, UYAP'tan indirilen belgeyi modele okutup mahkeme adı,
// esas no, karşı taraf ve duruşma tarihini çıkarıyor; sonuç doğrudan DOSYA
// KAYDINA yazılıyor. Hiçbir denetim yoktu: model bir esas numarası uydurursa
// avukatın dosyası yanlış numarayla açılıyor ve bu, boş bırakılmış bir alandan
// çok daha tehlikeli — çünkü DOLU görünüyor, kimse bir daha bakmıyor.
//
// Dilekçede aynı sorunu tarih için çözmüştük (uydurmaTarihleriAyikla). Künye
// aynı sınıftan: belgede geçmeyen bir değer, belgeden çıkarılmış olamaz.
//
// KURAL: bir alan ancak KARŞILIĞI BELGEDE VARSA kabul edilir. Yoksa alan
// boşaltılır ve avukata hangi alanın atıldığı söylenir. Boş alan doldurulabilir;
// yanlış alan fark edilmez.
//
// title (dosya başlığı) DIŞARIDA: o bir özet, belgede birebir geçmesi beklenmez.
// Yanlış başlık da rahatsız edicidir ama esas no gibi hak doğuran bir veri
// değildir; avukat listede görür ve düzeltir.
//
// Deno API'si KULLANMAZ; hem uç işlevi hem vitest içeri alabilsin.

export interface Kunye {
  title?: string;
  court_name?: string;
  case_number?: string;
  case_type?: string;
  opposing_party?: string;
  hearing_date?: string;
  /**
   * TARAFLARIN İKİSİ DE ÇIKARILIR.
   *
   * ÖLÇÜLEN ARIZA: yedi senaryonun ikisinde karşı taraf boş kaldı ve model
   * HAKLIYDI — belge kimin vekili olduğumuzu söylemiyor, dolayısıyla hangi
   * tarafın "karşı taraf" olduğu belgeden çıkarılamaz. Modele tahmin ettirmek,
   * dosyayı ters kurma riski demek.
   *
   * Ama avukata boş alan bırakmak da çözüm değil. İki taraf da çıkarılıp
   * ekranda seçtiriliyor: bir dokunuş, sıfır tahmin.
   */
  davaci?: string;
  davali?: string;
}

/**
 * Karşılaştırma için sadeleştirme.
 *
 * Türkçe küçük harfe indirger (JS'in /i bayrağı 'İ' harfini katlamaz), noktalama
 * ve fazla boşluğu atar. Amaç, "ANKARA 5. ASLİYE HUKUK MAHKEMESİ" ile
 * "Ankara 5.Asliye Hukuk Mahkemesi" arasındaki farkın eşleşmeyi bozmaması.
 */
export function sadelestir(v: unknown): string {
  return String(v ?? '')
    .toLocaleLowerCase('tr')
    .replace(/[^0-9a-zçğıöşü/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tarihi belgede aranabilecek biçimlere çevirir.
 *
 * Model YYYY-AA-GG döndürüyor; UYAP belgeleri ise GG/AA/YYYY ya da GG.AA.YYYY
 * yazıyor. Tek biçim aramak, doğru tarihi "belgede yok" saymak olurdu.
 */
export function tarihBicimleri(iso: string): string[] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? '').trim());
  if (!m) return [];
  const [, y, ay, g] = m;
  const gunSade = String(Number(g));
  const aySade = String(Number(ay));
  return [
    `${g}.${ay}.${y}`, `${g}/${ay}/${y}`, `${g}-${ay}-${y}`,
    `${gunSade}.${aySade}.${y}`, `${gunSade}/${aySade}/${y}`,
    `${y}-${ay}-${g}`,
  ];
}

/**
 * ESAS NUMARASI ÖZEL DURUM. Belgede "2026/123" yazarken model "2026/123 E."
 * ya da "E. 2026/123" döndürebiliyor. Aranan şey, sayı çiftinin kendisidir.
 */
export function esasCekirdegi(v: string): string | null {
  const m = /(\d{4})\s*\/\s*(\d+)/.exec(String(v ?? ''));
  return m ? `${m[1]}/${m[2]}` : null;
}

export interface KunyeSonuc {
  kunye: Kunye;
  /** Belgede karşılığı bulunamadığı için boşaltılan alanlar. */
  atilan: string[];
}

/**
 * Belgede karşılığı olmayan alanları boşaltır.
 *
 * Eşik neden "geçiyor mu" kadar basit: kısmi benzerlik ölçmek yanlış pozitif
 * üretir ve burada yanlış pozitifin bedeli, uydurma bir esas numarasının dosya
 * kaydına yazılmasıdır.
 */
export function kunyeDogrula(kunye: Kunye, belge: string): KunyeSonuc {
  const metin = sadelestir(belge);
  const cikti: Kunye = { title: (kunye.title ?? '').trim() || undefined };
  const atilan: string[] = [];

  const dogrula = (alan: keyof Kunye, etiket: string) => {
    const ham = (kunye[alan] ?? '').trim();
    if (!ham) return;
    if (metin.includes(sadelestir(ham))) {
      cikti[alan] = ham;
      return;
    }
    // Esas numarasında biçim farkı çok: çekirdek sayı çiftiyle de dene.
    if (alan === 'case_number') {
      const cekirdek = esasCekirdegi(ham);
      if (cekirdek && metin.includes(sadelestir(cekirdek))) {
        cikti[alan] = ham;
        return;
      }
    }
    atilan.push(etiket);
  };

  dogrula('court_name', 'mahkeme');
  dogrula('case_number', 'esas no');
  dogrula('opposing_party', 'karşı taraf');
  dogrula('davaci', 'davacı');
  dogrula('davali', 'davalı');

  // DAVA TÜRÜ ÇIKARIMDIR, ALINTI DEĞİL. "Kira alacağı ve tahliye" gibi bir tür
  // belgede o sözcüklerle geçmeyebilir ama belgeden anlaşılır. Atmıyoruz;
  // uydurma riski düşük ve avukat listede görüyor.
  const tur = (kunye.case_type ?? '').trim();
  if (tur) cikti.case_type = tur;

  const tarih = (kunye.hearing_date ?? '').trim();
  if (tarih) {
    const bicimler = tarihBicimleri(tarih);
    if (bicimler.length && bicimler.some((b) => metin.includes(sadelestir(b)))) {
      cikti.hearing_date = tarih;
    } else {
      atilan.push('duruşma tarihi');
    }
  }

  return { kunye: cikti, atilan };
}
