/**
 * MENFAAT ÇATIŞMASI TARAMASI — Türkçe kayıt gerçeğine göre.
 *
 * NEDEN ÖNEMLİ. Avukatlık Kanunu m.38/b uyarınca avukat, aynı işte menfaati
 * zıt tarafa hizmet edemez; evvelce karşı tarafın vekili olduğu işi de alamaz.
 * Bunu kaçırmanın bedeli disiplin sorumluluğudur ve dosyadan çekilmektir.
 * Uygulamanın avukat adına HATIRLAYABİLECEĞİ en değerli şey budur.
 *
 * BULUNAN EKSİK (ölçüldü). Eski eşleştirici (nameMatch.namesConflict) yalnız
 * normalleştirme + "biri diğerini içeriyor mu" bakıyordu. Gerçekçi sekiz
 * varyasyon denendi, BEŞİ KAÇIRILDI:
 *
 *   KAÇIRDI  "Ahmet Yılmaz"          vs "Yılmaz Ahmet"
 *   KAÇIRDI  "Ahmet Yılmaz"          vs "YILMAZ, Ahmet"
 *   KAÇIRDI  "Yılmaz İnşaat A.Ş."    vs "Yılmaz İnşaat Anonim Şirketi"
 *   KAÇIRDI  "Ahmet Yılmaz-Demir"    vs "Ahmet Yılmaz Demir"
 *   KAÇIRDI  "Mehmet Ali Kaya"       vs "Kaya Mehmet Ali"
 *
 * İlki tek başına yeterli sebep: UYAP ve adliye kayıtlarında ad SOYAD ÖNCE
 * yazılır, avukat ise müvekkilini "Ahmet Yılmaz" diye kaydeder. Yani en sık
 * karşılaşılacak biçim farkı, taramanın tamamen kör olduğu biçimdi.
 *
 * YÖN ASİMETRİKTİR — ve bu tasarımın temelidir. Yanlış NEGATİF (çatışmayı
 * kaçırmak) meslekî sorumluluk doğurur; yanlış POZİTİF yalnız gereksiz bir
 * uyarı satırıdır. Bu yüzden eşleştirme bilinçli olarak GENİŞ tutulur, ama
 * bulgular güç derecesine ayrılır ki uyarı yığını da güveni öldürmesin.
 */

/**
 * HUKUKİ FORM ekleri — yalnız bunlar atılır ve YALNIZ ADIN SONUNDAN.
 *
 * TESTİN YAKALADIĞI TASARIM HATASI. İlk hâlde "insaat", "turizm", "sanayi",
 * "ticaret", "holding" de bu listedeydi. Bu yanlıştı ve iki yönlü zarar
 * veriyordu:
 *   • KİMLİK YOK OLUYORDU: "Yılmaz İnşaat A.Ş." → yalnız "yilmaz" kalıyor,
 *     gerçek bir çatışma zayıf eşleşmeye düşüyordu.
 *   • YANLIŞ POZİTİF ÜRETİYORDU: "Yılmaz İnşaat" ile "Yılmaz Turizm" aynı
 *     anahtara iniyordu — oysa bunlar FARKLI şirketlerdir.
 * Sektör sözcüğü ticaret unvanının ayırt edici parçasıdır; atılmaz.
 *
 * SONDAN ATMA: Türk ticaret unvanlarında hukuki form her zaman sonda gelir
 * ("… Ltd. Şti."). Sondan atmak, "As Yapı" gibi baştaki "as" hecesinin
 * yanlışlıkla silinmesini de önler.
 */
const HUKUKI_FORM_EKLERI = [
  'as',
  'ltd',
  'sti',
  'anonim',
  'limited',
  'sirketi',
  'sirket',
  'kollektif',
  'komandit',
  'ortakligi',
  'ortaklari',
  'adi',
];

/** Kimlik taşımayan bağlaç — nerede geçerse geçsin atılır. */
const BAGLAC = 've';

/** Hitap/unvan önekleri. */
const UNVANLAR = ['av', 'avukat', 'dr', 'doc', 'prof', 'sayin', 'bay', 'bayan', 'mudur', 'mudurlugu'];

/**
 * Türkçe harfleri ASCII'ye indirger.
 *
 * NEDEN. Aynı kişi bir kayıtta "Şükrü Güneş", diğerinde "Sukru Gunes" olarak
 * girilebiliyor (klavye, kopyala-yapıştır, UYAP çıktısı). Türkçe karakter farkı
 * yüzünden çatışmayı kaçırmak, tam da kaçırılmaması gereken durumdur.
 * Küçültme ÖNCE 'tr-TR' ile yapılır: aksi hâlde "I" harfi "i"ye iner ve
 * "IŞIK" ile "ışık" ayrışır.
 */
export function turkceSadelestir(v: string): string {
  const kucuk = (v ?? '').toLocaleLowerCase('tr-TR');
  const harita: Record<string, string> = {
    ç: 'c', ğ: 'g', ı: 'i', i: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u',
  };
  return kucuk.replace(/[çğıiöşüâîû]/g, (h) => harita[h] ?? h);
}

/**
 * Bir taraf adını karşılaştırılabilir sözcük kümesine indirger:
 * noktalama atılır, unvan ve şirket ekleri düşer, sözcükler sıralanır.
 *
 * Sıralama, "Ahmet Yılmaz" ile "Yılmaz Ahmet"i aynı yapan adımdır.
 */
export function adSozcukleri(ad: string): string[] {
  const temiz = turkceSadelestir(ad)
    // NOKTA SİLİNİR, BOŞLUĞA ÇEVRİLMEZ. "A.Ş." noktadan bölünürse [a, s] diye
    // iki anlamsız harf üretir ve unvan eki listesindeki "as" ile eşleşmez;
    // testte "A.Ş." ile "Anonim Şirketi" bu yüzden birebir tutmuyordu.
    // Kısaltmanın harfleri bitişik kalmalı: "a.ş." -> "as".
    .replace(/\./g, '')
    .replace(/[,;:()"'`/\\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!temiz) return [];
  const sozcukler = temiz
    .split(' ')
    .filter((s) => s.length > 0)
    .filter((s) => !UNVANLAR.includes(s))
    .filter((s) => s !== BAGLAC);

  // Hukuki form eklerini SONDAN, tükenene kadar at.
  while (sozcukler.length > 0 && HUKUKI_FORM_EKLERI.includes(sozcukler[sozcukler.length - 1]!)) {
    sozcukler.pop();
  }
  return sozcukler;
}

/** Karşılaştırma anahtarı: sözcükler sıralı ve tekilleştirilmiş. */
export function adAnahtari(ad: string): string {
  return Array.from(new Set(adSozcukleri(ad))).sort().join(' ');
}

export type EslesmeGucu = 'kesin' | 'guclu' | 'zayif';

/**
 * İki taraf adı aynı kişiyi/kurumu gösteriyor olabilir mi?
 *
 * 'kesin'  — sözcük kümeleri birebir aynı (sıra farkı dâhil).
 * 'guclu'  — kısa olanın TÜM sözcükleri uzun olanın içinde ve en az iki sözcük
 *            ortak (ör. "Yılmaz İnşaat" ⊂ "Yılmaz İnşaat Turizm").
 * 'zayif'  — tek ayırt edici sözcük paylaşılıyor (ör. yalnız soyadı). Uyarı
 *            olarak gösterilir ama öne çıkarılmaz; bunu tamamen atmak, ender
 *            de olsa gerçek bir çatışmayı gizlerdi.
 * null     — ilgisiz.
 */
export function adEslesmesi(a: string, b: string): EslesmeGucu | null {
  const sa = Array.from(new Set(adSozcukleri(a)));
  const sb = Array.from(new Set(adSozcukleri(b)));
  if (sa.length === 0 || sb.length === 0) return null;

  const anahtarA = [...sa].sort().join(' ');
  const anahtarB = [...sb].sort().join(' ');
  if (anahtarA === anahtarB) return 'kesin';

  const kisa = sa.length <= sb.length ? sa : sb;
  const uzun = kisa === sa ? sb : sa;
  const ortak = kisa.filter((s) => uzun.includes(s));

  if (ortak.length === kisa.length && kisa.length >= 2) return 'guclu';
  // Tek sözcüklük ad (yalnız "Ahmet") ayırt edici değildir; eşleşme sayılmaz.
  if (ortak.length >= 2) return 'guclu';
  if (ortak.length === 1 && kisa.length >= 2 && ortak[0]!.length >= 4) return 'zayif';
  return null;
}

/** TC kimlik numaraları aynı mı? Ad benzerliğinden GÜÇLÜ bir kanıttır. */
export function tcAyniMi(a: string | null | undefined, b: string | null | undefined): boolean {
  const t = (v: string | null | undefined) => (v ?? '').replace(/\D/g, '');
  const ta = t(a);
  const tb = t(b);
  return ta.length === 11 && ta === tb;
}

export type BulguTuru =
  /** Kaydedilmek istenen kişi, mevcut bir dosyada KARŞI TARAF. */
  | 'karsi-taraf'
  /** Kaydedilmek istenen karşı taraf, mevcut bir MÜVEKKİL. */
  | 'muvekkil'
  /** Aynı TC ile başka bir müvekkil kaydı var (mükerrer kayıt). */
  | 'mukerrer-tc'
  /** Karşı vekil, kendi ofisinizin bir üyesi. */
  | 'ofis-karsi-vekil';

export interface Bulgu {
  tur: BulguTuru;
  guc: EslesmeGucu;
  /** Çatışmanın bulunduğu kaydın kimliği (dava ya da müvekkil). */
  kayitId: string;
  /** Ekranda gösterilecek kayıt adı (dava başlığı ya da müvekkil adı). */
  kayitAdi: string;
  /** Eşleşen metin (karşı taraf adı ya da müvekkil adı). */
  eslesenAd: string;
}

export interface TaramaGirdisi {
  /** Kaydedilmek istenen ad. */
  ad: string;
  /** Varsa şirket/unvan (müvekkil formunda ayrı alan). */
  sirket?: string | null;
  tcNo?: string | null;
  /** Düzenleme hâlinde kendi kaydını çatışma sayma. */
  hariçTutulanId?: string | null;
}

export interface TaramaKaynagi {
  muvekkiller: { id: string; full_name: string; company?: string | null; tc_no?: string | null }[];
  davalar: { id: string; title: string; opposing_party?: string | null; opposing_counsel?: string | null }[];
  /** Kendi ofis üyeleri — karşı vekil olarak çıkarlarsa gerçek çatışmadır. */
  ofisUyeleri?: { id: string; full_name: string }[];
}

/** Bulguları güçten zayıfa sıralar; ekran en ağırını önce göstersin. */
const GUC_SIRASI: Record<EslesmeGucu, number> = { kesin: 0, guclu: 1, zayif: 2 };

/**
 * KAPSAMLI TARAMA. Tek bir eşleşme değil, BÜTÜN bulguları döndürür.
 *
 * Eski davranış `.find(...)` ile ilk eşleşmede duruyordu: aynı kişi üç ayrı
 * dosyada karşı tarafsa avukat yalnız birini görüyordu — oysa çatışmanın
 * kapsamı tam olarak kaç dosyaya dokunduğudur.
 */
export function menfaatTara(girdi: TaramaGirdisi, kaynak: TaramaKaynagi): Bulgu[] {
  const bulgular: Bulgu[] = [];
  const adaylar = [girdi.ad, girdi.sirket ?? ''].filter((s) => s.trim().length > 0);
  if (adaylar.length === 0 && !girdi.tcNo) return [];

  const enIyiEslesme = (hedef: string): EslesmeGucu | null => {
    let en: EslesmeGucu | null = null;
    for (const aday of adaylar) {
      const g = adEslesmesi(aday, hedef);
      if (g && (en === null || GUC_SIRASI[g] < GUC_SIRASI[en])) en = g;
    }
    return en;
  };

  // 1) Kaydedilen ad, mevcut dosyalarda karşı taraf mı?
  for (const dava of kaynak.davalar) {
    if (girdi.hariçTutulanId && dava.id === girdi.hariçTutulanId) continue;
    if (dava.opposing_party) {
      const g = enIyiEslesme(dava.opposing_party);
      if (g) {
        bulgular.push({
          tur: 'karsi-taraf',
          guc: g,
          kayitId: dava.id,
          kayitAdi: dava.title,
          eslesenAd: dava.opposing_party,
        });
      }
    }
  }

  // 2) Kaydedilen ad, mevcut müvekkillerden biri mi? (karşı taraf girilirken)
  for (const muvekkil of kaynak.muvekkiller) {
    if (girdi.hariçTutulanId && muvekkil.id === girdi.hariçTutulanId) continue;

    if (girdi.tcNo && tcAyniMi(girdi.tcNo, muvekkil.tc_no)) {
      bulgular.push({
        tur: 'mukerrer-tc',
        guc: 'kesin',
        kayitId: muvekkil.id,
        kayitAdi: muvekkil.full_name,
        eslesenAd: muvekkil.full_name,
      });
      continue;
    }

    const hedefler = [muvekkil.full_name, muvekkil.company ?? ''].filter((s) => s.trim().length > 0);
    let en: EslesmeGucu | null = null;
    let eslesen = muvekkil.full_name;
    for (const hedef of hedefler) {
      const g = enIyiEslesme(hedef);
      if (g && (en === null || GUC_SIRASI[g] < GUC_SIRASI[en])) {
        en = g;
        eslesen = hedef;
      }
    }
    if (en) {
      bulgular.push({
        tur: 'muvekkil',
        guc: en,
        kayitId: muvekkil.id,
        kayitAdi: muvekkil.full_name,
        eslesenAd: eslesen,
      });
    }
  }

  // 3) Karşı vekil kendi ofisimizden biri mi? Aynı büro iki tarafta olamaz.
  for (const uye of kaynak.ofisUyeleri ?? []) {
    for (const dava of kaynak.davalar) {
      if (!dava.opposing_counsel) continue;
      const g = adEslesmesi(uye.full_name, dava.opposing_counsel);
      if (g && g !== 'zayif') {
        bulgular.push({
          tur: 'ofis-karsi-vekil',
          guc: g,
          kayitId: dava.id,
          kayitAdi: dava.title,
          eslesenAd: dava.opposing_counsel,
        });
      }
    }
  }

  bulgular.sort((a, b) => GUC_SIRASI[a.guc] - GUC_SIRASI[b.guc]);
  return bulgular;
}

/** Uyarının "engel" seviyesinde mi yoksa bilgi amaçlı mı olduğunu söyler. */
export function ciddiMi(bulgular: Bulgu[]): boolean {
  return bulgular.some((b) => b.guc === 'kesin' || b.guc === 'guclu');
}
