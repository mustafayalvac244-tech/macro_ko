// İÇTİHAT (KARAR) ATIFLARI — metinden çıkarma ve olanaksızlık denetimi.
// ---------------------------------------------------------------------------
// NEDEN VAR. Madde atfı denetimi (bkz. atif.ts) aylardır çalışıyor: "TBK m.999"
// yazarsa model, avukat uyarıyı görüyor. KARAR atfında ise hiçbir denetim
// YOKTU — oysa avukat için en pahalı uydurma türü budur:
//
//   "Yargıtay 9. HD, 2019/12345 E., 2020/6789 K."
//
// Bu satır gerçek GÖRÜNÜR: daire vardır, esas/karar numarası biçimce doğrudur,
// yıllar tutarlıdır. Dilekçeye konur, karşı taraf UYAP'tan arar, bulamaz. Madde
// uydurmasından farkı şu: yanlış maddeyi hâkim okuduğu an anlar; uydurma karar
// numarası ise dosyaya girer, ilk fark eden karşı vekil olur.
//
// ÜÇ AYRI SONUÇ ÜRETİLİR, BİRBİRİNE KARIŞTIRILMAZ:
//
//   1. DOĞRULANDI  — atıf bizim havuzumuzda bulundu. Kesin bilgi.
//   2. HAVUZDA YOK — bulunamadı. Bu UYDURMA DEMEK DEĞİLDİR: havuzumuzda
//      ~11 bin karar var, Yargıtay'ın verdiği karar sayısı milyonlarca. Yokluk
//      bizim eksiğimizdir, atfın yanlışlığı değil. "Teyit ediniz" denir.
//   3. OLANAKSIZ   — atıf, havuzdan BAĞIMSIZ olarak mantıken olamaz. Karar yılı
//      esas yılından önce olamaz; gelecek yıl numarası verilemez; Yargıtay'ın
//      47. Hukuk Dairesi hiç var olmadı. Burada korpus büyüklüğü konuşmaz,
//      aritmetik konuşur — bu yüzden kesin konuşabiliriz.
//
// 2. ile 3.'ü ayırmak bu dosyanın bütün amacıdır. İkisini "uydurma" diye tek
// kovaya atmak iki yönde de yanlış olurdu: gerçek bir kararı uydurma diye
// işaretlemek (uyarı gürültüye döner, avukat bir daha bakmaz) ya da olanaksız
// bir atfı "belki vardır" diye geçiştirmek.
//
// Deno API'si KULLANMAZ; hem uç işlevi hem vitest içeri alabilsin.

export interface KararAtif {
  /** Metinde yazıldığı hâli — uyarıda avukata bunu gösteriyoruz. */
  ham: string;
  /** 'Yargıtay' | 'Danıştay' | 'AYM' | 'BAM' | '' (yazılmamış) */
  mahkeme: string;
  /** 'HD' (hukuk dairesi) | 'CD' (ceza dairesi) | 'D' (Danıştay dairesi) | '' */
  daireTur: string;
  /** Daire numarası (9. HD → 9). Yazılmamışsa 0. */
  daireNo: number;
  esasYil: number;
  esasNo: string;
  /** Karar numarası yazılmamış olabilir (yalnız esas verilen atıflar yaygındır). */
  kararYil: number;
  kararNo: string;
}

export interface TutarsizKarar {
  atif: KararAtif;
  /** Makine tarafında sabit anahtar; ekranda i18n ile karşılığı yazılır. */
  sebep: 'gelecek_yil' | 'karar_esastan_once' | 'daire_yok' | 'cok_eski';
}

/**
 * Yargıtay/Danıştay daire sayıları — EN GENİŞ TARİHSEL aralık alınır.
 *
 * 2020 yapılandırmasıyla Yargıtay hukuk dairesi sayısı düştü (23 → 11), ama
 * 2015 tarihli gerçek bir "Yargıtay 22. HD" kararı bugün de atıf konusudur.
 * Dar aralık almak, GERÇEK kararları olanaksız diye işaretlerdi. Bu yüzden üst
 * sınır, o dairenin hiç var olmadığı numaradan başlar.
 */
const DAIRE_TAVANI: Record<string, number> = {
  HD: 23, // Yargıtay hukuk daireleri en geniş hâliyle 1-23
  CD: 23, // ceza daireleri en geniş hâliyle 1-23
  D: 17,  // Danıştay dava daireleri
};

/** Esas/karar numarasının sayı kısmı: "12345", "1-123", "(9)-123" biçimleri. */
function numaraGecerli(no: string): boolean {
  const d = no.replace(/\s+/g, '');
  if (!d) return false;
  if (!/^\(?\d/.test(d)) return false;
  if (!/\d$/.test(d)) return false;
  return /^[\d()\-–—]+$/.test(d);
}

function sadeNumara(no: string): string {
  return no.replace(/\s+/g, '').replace(/[–—]/g, '-');
}

/** Atıftan önceki metin penceresinden mahkeme/daire bilgisini okur. */
function mahkemeOku(pencere: string): Pick<KararAtif, 'mahkeme' | 'daireTur' | 'daireNo'> {
  const p = pencere.toLocaleLowerCase('tr');
  let mahkeme = '';
  if (/yarg[ıi]tay|\by\s*\.\s*\d|hgk|cgk|\bhd\b|\bcd\b/.test(p)) mahkeme = 'Yargıtay';
  if (/dan[ıi][şs]tay|\biddk\b|\bvddk\b/.test(p)) mahkeme = 'Danıştay';
  if (/anayasa mahkemesi|\baym\b/.test(p)) mahkeme = 'AYM';
  if (/b[öo]lge adliye|\bbam\b/.test(p)) mahkeme = 'BAM';

  let daireTur = '';
  let daireNo = 0;

  /**
   * SON eşleşmeyi alır, ilkini DEĞİL.
   *
   * ÖLÇÜLEN HATA (12.09.2026, tarayıcı sınamasında çıktı). Pencere, atıftan
   * ÖNCEKİ 90 karakterdir; atfın dairesi o pencerenin SONUNDA durur. Burada
   * `.match()` kullanılıyordu ve o ilk eşleşmeyi döndürür. Bir paragrafta iki
   * karar arka arkaya anıldığında ikincinin dairesi BİRİNCİDEN okunuyordu:
   *   "... Yargıtay 9. HD 2021/4412 E. ... ile Yargıtay 47. HD 2019/1 E. ..."
   * ikinci atıf "47. HD" değil "9. HD" sayılıyordu. İki yönde de zarar verir:
   * var olmayan 47. daire YAKALANMAZ; ters durumda gerçek bir "3. HD" kararı,
   * önündeki olmayan daireyi miras alıp "olamaz" diye İŞARETLENİR — ve yanlış
   * pozitif burada kaçırmaktan pahalıdır, avukat uyarıya bir daha bakmaz.
   */
  const sonEslesme = (re: RegExp): RegExpMatchArray | null => {
    let son: RegExpMatchArray | null = null;
    for (const m of p.matchAll(re)) son = m;
    return son;
  };

  // "9. Hukuk Dairesi", "9. HD", "9.HD", "9 CD"
  const yargitay = sonEslesme(/(\d{1,2})\s*\.?\s*(hukuk|ceza|hd|cd)\b/g);
  if (yargitay) {
    daireNo = Number(yargitay[1]);
    const tur = yargitay[2];
    daireTur = tur === 'hukuk' || tur === 'hd' ? 'HD' : 'CD';
  }

  // Danıştay dairesi: "Danıştay 10. Daire" — "Hukuk/Ceza" geçmez.
  if (mahkeme === 'Danıştay') {
    const dan = sonEslesme(/(\d{1,2})\s*\.?\s*daire/g);
    if (dan) {
      daireNo = Number(dan[1]);
      daireTur = 'D';
    } else if (daireTur === 'HD' || daireTur === 'CD') {
      // "Danıştay 10. HD" diye bir şey yok; tür bilgisini güvenilmez sayıp
      // düşürüyoruz ki olmayan bir daireyi olanaksız diye işaretlemeyelim.
      daireTur = '';
      daireNo = 0;
    }
  }

  // Genel kurul atıflarında daire numarası YOKTUR ("HGK 2020/1-123 E.").
  // Yukarıdaki desen "2020/1" içindeki rakamı daire sanabilir; engelliyoruz.
  if (/hgk|cgk|genel kurul|iddk|vddk/.test(p)) {
    daireTur = '';
    daireNo = 0;
  }

  return { mahkeme, daireTur, daireNo };
}

// SONEKLİ yazılış: "2019/12345 E." · "2020/6789 K." · "2019/123 Esas" · "2020/45 Karar"
// Harf, ardından harf gelirse eşleşmez ("2020/12 Ekim" atıf değildir).
const PARCA =
  /(\d{4})\s*\/\s*([\d()\-–—\s]{1,16}?)\s*(E|K|Esas|Karar)(?![A-Za-zÇĞİÖŞÜçğıöşü])\.?/gi;

// ÖNEKLİ yazılış (22. ajan, 10.10.2026): "E. 2019/12345" · "E.2019/12345" ·
// "Esas No: 2019/123" · "Karar: 2020/45". Etiket kelimenin İÇİNDEN alınmaz
// (önünde harf/rakam olamaz) ve büyük harfle yazılır; noktalama ya da "No"
// zorunlu — etiketsiz "karar 2020/45" düz cümledir, atıf değildir.
const ONEK = new RegExp(
  String.raw`(?<![A-Za-zÇĞİÖŞÜçğıöşü\d])((?:E|K)\s*[.:]\s*|(?:Esas|ESAS|Karar|KARAR)(?:\s*(?:No|NO)\b\s*[.:]?|\s*[.:])\s*)` +
    String.raw`(\d{4})\s*\/\s*(\(?\d+\)?(?:\s*[-–—]\s*\(?\d+\)?)*)`,
  'g'
);

/** Metinde bulunmuş tek bir numara parçası ve etiketi. */
interface Parca {
  yil: number;
  no: string;
  tur: 'E' | 'K';
  /** Parçanın metindeki başı/sonu (önekliyse etiketle, soneklıyse sayıyla başlar). */
  bas: number;
  son: number;
  /** Yıl rakamının başladığı yer: aynı sayıyı iki okuyucunun bulup bulmadığını bu belirler. */
  sayiBas: number;
  /** Etiket harfinin (E/K/Esas/Karar) başladığı yer: bir etiket iki sayıya birden verilemez. */
  etiketBas: number;
}

/**
 * İki yazılışı tek listeye birleştirir.
 *
 * ÇAKIŞMA. "E.2019/12345 K.2020/6789" soneklı okuyucuya "2019/12345 K" gibi
 * görünür (esası KARAR sanardı); "2019/123 E. 2020/456 K." ise önekli okuyucuya
 * "E. 2020/456" gibi görünür. Aynı etiket iki sayı arasında paylaşılıyorsa
 * etiket, etiketi OLMAYAN sayıya verilir: önünde kendi etiketi olan sayı o
 * etiketi komşusundan çalmaz.
 */
function parcalariBul(d: string): Parca[] {
  const haritaYap = new Map<number, { on?: Parca; sonek?: Parca }>();

  for (const m of d.matchAll(ONEK)) {
    if (!numaraGecerli(m[3])) continue;
    const bas = m.index ?? 0;
    haritaYap.set(bas + m[1].length, {
      on: {
        yil: Number(m[2]),
        no: sadeNumara(m[3]),
        tur: m[1].startsWith('E') ? 'E' : 'K',
        bas,
        son: bas + m[0].length,
        sayiBas: bas + m[1].length,
        etiketBas: bas,
      },
    });
  }

  PARCA.lastIndex = 0;
  for (const m of d.matchAll(PARCA)) {
    if (!numaraGecerli(m[2])) continue;
    const bas = m.index ?? 0;
    const son = bas + m[0].length;
    const sonek: Parca = {
      yil: Number(m[1]),
      no: sadeNumara(m[2]),
      tur: m[3].toLocaleUpperCase('tr').startsWith('E') ? 'E' : 'K',
      bas,
      son,
      sayiBas: bas,
      etiketBas: son - m[3].length - (m[0].endsWith('.') ? 1 : 0),
    };
    haritaYap.set(bas, { ...haritaYap.get(bas), sonek });
  }

  const sirali = [...haritaYap.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
  const alinan = new Set<number>();
  const secilen: Parca[] = [];
  sirali.forEach((t, i) => {
    const onOk = !!t.on && !alinan.has(t.on.etiketBas);
    const sonOk = !!t.sonek && !alinan.has(t.sonek.etiketBas);
    let sec: Parca | undefined;
    if (onOk && sonOk) {
      const sonraki = sirali[i + 1];
      // Soneklı etiket, bir sonraki sayının ÖN etiketiyse onundur.
      sec = sonraki?.on && sonraki.on.etiketBas === t.sonek!.etiketBas ? t.on : t.sonek;
    } else {
      sec = onOk ? t.on : sonOk ? t.sonek : undefined;
    }
    if (sec) {
      alinan.add(sec.etiketBas);
      secilen.push(sec);
    }
  });
  return secilen;
}

/** Atfın metindeki yeri (tekrar-elenmemiş listede künyeyi çıkarmak için). */
export type KararGecisi = KararAtif & { bas: number; son: number };

/**
 * Metindeki BÜTÜN künye geçişleri, tekrar elenmeden ve konumlarıyla.
 *
 * `kararAtiflari` aynı künyeyi bir kez verir (avukata iki kez sormayalım); ama
 * künyeyi metinden ÇIKARIRKEN her geçiş gerekir — özellikle aynı künye başka
 * boşluk/önek yazılışıyla ikinci kez geçmişse.
 */
export function kararGecisleri(metin: string): KararGecisi[] {
  const d = String(metin ?? '');
  const parcalar = parcalariBul(d);

  const cikan: KararGecisi[] = [];
  let i = 0;
  while (i < parcalar.length) {
    const p = parcalar[i];
    let esas = p;
    let karar: Parca | null = null;

    if (p.tur === 'E') {
      const sonraki = parcalar[i + 1];
      // 40 karakter: "2019/12345 E., 2020/6789 K." arasındaki en uzun makul
      // ayraç ("sayılı kararı" gibi araya giren söz dahil) bu pencereye sığar.
      if (sonraki && sonraki.tur === 'K' && sonraki.bas - p.son <= 40) {
        karar = sonraki;
        i += 2;
      } else {
        i += 1;
      }
    } else {
      // Önünde esası olmayan tek başına karar numarası.
      karar = p;
      esas = p;
      i += 1;
    }

    const pencereBas = Math.max(0, p.bas - 90);
    const { mahkeme, daireTur, daireNo } = mahkemeOku(d.slice(pencereBas, p.bas));
    const son = (karar ?? p).son;

    cikan.push({
      ham: d.slice(p.bas, son).replace(/\s+/g, ' ').trim(),
      mahkeme,
      daireTur,
      daireNo,
      esasYil: p.tur === 'E' ? esas.yil : 0,
      esasNo: p.tur === 'E' ? esas.no : '',
      kararYil: karar ? karar.yil : 0,
      kararNo: karar ? karar.no : '',
      bas: p.bas,
      son,
    });
  }
  return cikan;
}

/** İki geçişin aynı künye olup olmadığını belirleyen anahtar (yalnız numaralar). */
export function atifAnahtari(a: KararAtif): string {
  return `${a.esasYil}/${a.esasNo}#${a.kararYil}/${a.kararNo}`;
}

/**
 * Metindeki içtihat atıflarını çıkarır.
 *
 * Esas ve karar numarası AYRI yazılır ("2019/12345 E., 2020/6789 K." ya da
 * "E. 2019/12345, K. 2020/6789"); ikisi yan yanaysa TEK atıf sayılır. Yalnız
 * esas verilen atıf da geçerlidir ve yaygındır — karar numarası olmadan da
 * UYAP'ta aranabilir.
 */
export function kararAtiflari(metin: string): KararAtif[] {
  // Aynı atıf metinde birden çok geçebilir; avukata iki kez sormayalım.
  const anahtar = new Set<string>();
  return kararGecisleri(metin).filter((a) => {
    const k = atifAnahtari(a);
    if (anahtar.has(k)) return false;
    anahtar.add(k);
    return true;
  });
}

/**
 * HAVUZDAN BAĞIMSIZ OLANAKSIZLIK DENETİMİ.
 *
 * Buradaki her kural, korpusumuzun büyüklüğünden bağımsız olarak doğrudur.
 * Bir kararın havuzumuzda olmaması hiçbir şey kanıtlamaz; ama karar yılının
 * esas yılından önce olması, dosya açılmadan karar verilmiş demektir ve bu
 * olamaz. Kesin konuşabildiğimiz tek yer burasıdır — o yüzden kurallar dar
 * tutuldu, "şüpheli" olanlar bilerek dışarıda bırakıldı.
 *
 * @param bugunYil  Üst sınır. Testin sabit kalması için dışarıdan verilir.
 */
export function tutarsizKararlar(atiflar: KararAtif[], bugunYil: number): TutarsizKarar[] {
  const cikan: TutarsizKarar[] = [];
  for (const a of atiflar) {
    const yillar = [a.esasYil, a.kararYil].filter((y) => y > 0);
    if (yillar.some((y) => y > bugunYil)) {
      cikan.push({ atif: a, sebep: 'gelecek_yil' });
      continue;
    }
    // 1950 öncesi: Yargıtay kararları var ama bugünün dilekçesinde atıf konusu
    // olmaz ve bu aralıkta gördüğümüz sayılar hep biçim hatasıydı. Yine de
    // "çok eski" ayrı bir sebep — "olmayan daire" ile aynı ağırlıkta değil.
    if (yillar.some((y) => y < 1950)) {
      cikan.push({ atif: a, sebep: 'cok_eski' });
      continue;
    }
    if (a.esasYil > 0 && a.kararYil > 0 && a.kararYil < a.esasYil) {
      cikan.push({ atif: a, sebep: 'karar_esastan_once' });
      continue;
    }
    // Tavan YARGITAY/DANIŞTAY sayılarıdır. BAM (bölge adliye) daireleri 23'ün
    // üstüne çıkar ("İstanbul BAM 45. Hukuk Dairesi" gerçektir); mahkemesi
    // yazılmamış "47. Hukuk Dairesi" de Yargıtay diye ilan edilemez.
    // (22. ajan, 10.10.2026: eskiden mahkemeye bakılmıyordu, BAM künyesi
    // "olamaz" diye işaretlenip metinden silinebiliyordu.)
    const tavan =
      a.mahkeme === 'Yargıtay' || a.mahkeme === 'Danıştay' ? DAIRE_TAVANI[a.daireTur] : undefined;
    if (tavan && a.daireNo > tavan) {
      cikan.push({ atif: a, sebep: 'daire_yok' });
      continue;
    }
  }
  return cikan;
}

/**
 * DAİRE ANAHTARI — "Yargıtay 9. Hukuk Dairesi" → "9HD", "3. Ceza Dairesi" →
 * "3CD", "Danıştay 10. Daire" → "10D". Numarası okunamayan ad (Genel Kurul,
 * yalnız "Yargıtay" vb.) '' döner: o kayıt hakkında daire bilinmiyor demektir.
 * SQL tarafındaki `karar_atfi_daire_no` (0202) ile AYNI kural.
 */
export function daireAnahtari(daire: string): string {
  const m = /(\d{1,2})\s*\.?\s*(hukuk|ceza|daire)/i.exec(String(daire ?? ''));
  if (!m) return '';
  const tur = m[2].toLocaleLowerCase('tr');
  return `${Number(m[1])}${tur === 'hukuk' ? 'HD' : tur === 'ceza' ? 'CD' : 'D'}`;
}

/** Metinde yazılan atfın daire anahtarı; daire yazılmamışsa ''. */
export function atifDaireAnahtari(a: KararAtif): string {
  return a.daireNo && a.daireTur ? `${a.daireNo}${a.daireTur}` : '';
}

/**
 * İstenen daire, kayıttaki daireyle bağdaşır mı? Yalnız İKİSİ de biliniyorsa ve
 * farklıysa false: bilinmeyen tarafta eski davranış (eşleşme) korunur, çünkü
 * bilinmeyeni reddetmek gerçek kararı "yok" sayardı.
 *
 * NEDEN. Esas numarası her dairede AYRI işler: "2019/1234" hem 3. HD'de hem
 * 9. HD'de vardır. Yalnız numaraya bakan eşleşme, uydurma "9. HD 2019/1234"
 * künyesini başka dairenin gerçek kararıyla "doğrulandı" yapıyordu.
 * (Mahkeme düzeyi — BAM'a karşı Yargıtay — ayrıca karşılaştırılmaz: aynı
 * daire numarası + türü + esas numarası çakışması bugün ölçülmedi.)
 */
export function daireAnahtarlariUyumlu(istenen: string, kayitDaire: string): boolean {
  const kayit = daireAnahtari(kayitDaire);
  return !istenen || !kayit || istenen === kayit;
}

export function daireUyumlu(a: KararAtif, kayitDaire: string): boolean {
  return daireAnahtarlariUyumlu(atifDaireAnahtari(a), kayitDaire);
}

/**
 * RPC'ye gidecek sade biçim — yalnız havuzda aranabilir alanlar. `daire`
 * (örn. "9HD") varsa havuzdaki_kararlar yalnız o daireninkini (ya da dairesi
 * bilinmeyen kaydı) "bulundu" sayar (göç 0202); eski işlev fazla alanı yok sayar.
 */
export function havuzSorgusu(atiflar: KararAtif[]): Array<{ esas: string; karar: string; daire: string }> {
  return atiflar
    .filter((a) => a.esasNo || a.kararNo)
    .map((a) => ({
      esas: a.esasYil ? `${a.esasYil}/${a.esasNo}` : '',
      karar: a.kararYil ? `${a.kararYil}/${a.kararNo}` : '',
      daire: atifDaireAnahtari(a),
    }));
}

/**
 * KÜNYELERİ METİNDEN ÇIKAR — boşluk ve yazılış farkına dayanıklı.
 *
 * ÖNCEKİ KUSUR (22. ajan, 10.10.2026). Çıkarma `metin.split(ham).join(...)`
 * idi; `ham` boşlukları tek aralığa indirilmiş hâldedir, metinde satır sonu ya
 * da çift boşluk varsa hiçbir şey bulunmuyor, künye METİNDE KALIYOR ama ekran
 * "n künye çıkarıldı" diyordu. Aynı künye başka yazılışta ("E. …, K. …") tekrar
 * geçerse tekrar-eleme yüzünden o da kalıyordu.
 *
 * Burada künye ham dizeye göre değil NUMARALARINA göre bulunur ve bulunan her
 * geçiş konumuyla değiştirilir (sağdan sola, çakışma olmaz).
 *
 * @returns değişen: `hamlar` içinden metinde GERÇEKTEN çıkarılanlar.
 */
export function kunyeleriDegistir(
  metin: string,
  hamlar: string[],
  yerine: string
): { metin: string; degisen: string[] } {
  const hedef = new Set<string>();
  for (const h of hamlar) for (const a of kararAtiflari(h)) hedef.add(atifAnahtari(a));
  const aralik = kararGecisleri(metin)
    .filter((g) => hedef.has(atifAnahtari(g)))
    .sort((x, y) => y.bas - x.bas);
  let m = String(metin ?? '');
  const yapilan = new Set<string>();
  for (const g of aralik) {
    m = m.slice(0, g.bas) + yerine + m.slice(g.son);
    yapilan.add(atifAnahtari(g));
  }
  const degisen = hamlar.filter((h) => kararAtiflari(h).some((a) => yapilan.has(atifAnahtari(a))));
  return { metin: m, degisen };
}

// Cümle sonu: en az dört harfli sözcüğün noktalaması ya da satır sonu. "9." gibi
// sıra sayıları, "m." / "E." / "K." / "bkz." kısaltmaları cümleyi BÖLMEZ.
const CUMLE_SONU = /\p{L}{4,}[.!?](?=\s|$)|\n/gu;

/**
 * Künyenin geçtiği cümle, künye(ler)i çıkarılmış hâliyle (≤300 karakter).
 *
 * ÖNCEKİ KUSUR (22. ajan, 10.10.2026). Sınır her '.' idi: "Yargıtay 9. HD …"
 * içindeki "9." cümle başı sayılıyor, konu sözcükleri düşüyor ve FTS'e
 * "HD sayılı kararında …" gibi bir artık gidiyordu.
 */
export function kunyeCumlesi(metin: string, ham: string): string {
  const d = String(metin ?? '');
  const hedef = kararAtiflari(ham)[0];
  if (!hedef) return '';
  const gecisler = kararGecisleri(d);
  const g = gecisler.find((x) => atifAnahtari(x) === atifAnahtari(hedef));
  if (!g) return '';

  let bas = 0;
  for (const m of d.slice(0, g.bas).matchAll(CUMLE_SONU)) bas = (m.index ?? 0) + m[0].length;
  CUMLE_SONU.lastIndex = g.son;
  const sonrasi = CUMLE_SONU.exec(d);
  CUMLE_SONU.lastIndex = 0;
  const son = sonrasi ? (sonrasi[0] === '\n' ? sonrasi.index : sonrasi.index + sonrasi[0].length) : d.length;

  // Cümlenin içindeki BÜTÜN künyeler çıkarılır: numaraları FTS'e terim olarak
  // gitmesin, öneriyi konudan saptırmasın.
  let parca = '';
  let imlec = bas;
  for (const x of gecisler.filter((y) => y.bas >= bas && y.son <= son)) {
    parca += d.slice(imlec, x.bas) + ' ';
    imlec = x.son;
  }
  parca += d.slice(imlec, son);
  return parca.replace(/\s+/g, ' ').trim().slice(0, 300);
}

/**
 * Künye kalıbı sözcükleri: bunlar konu taşımaz, her karar metninde geçer.
 * Cümle yalnız bunlardan oluşuyorsa FTS rastgele "Yargıtay" kararı döndürür.
 */
const KALIP_SOZCUK = new Set([
  'yargıtay', 'danıştay', 'hukuk', 'dairesi', 'daire', 'ceza', 'genel', 'kurulu', 'sayılı', 'karar',
  'kararı', 'kararında', 'kararının', 'kararına', 'kararıyla', 'kararlar', 'kararları', 'esas', 'uyarınca',
  'nitekim', 'ayrıca', 'emsal', 'içtihat', 'yerleşik', 'doğrultusunda', 'yönünde',
]);

/**
 * Öneri aramasına gönderilecek cümlede konu var mı? En az 3 farklı, kalıp
 * dışı, ≥5 harfli sözcük aranır. TAHMİN: "3" ve "5" ölçülmedi, bilerek
 * KORUYUCU (az öneri, yanlış öneriden iyidir; avukata zaten İçtihat Arama
 * gösterilir). Gerçek kullanımda öneri isabeti ölçülünce ayarlanmalı.
 */
export function oneriCumlesiYeterli(cumle: string): boolean {
  const sozcukler = new Set(String(cumle ?? '').toLocaleLowerCase('tr').match(/\p{L}{5,}/gu) ?? []);
  let konu = 0;
  for (const s of sozcukler) if (!KALIP_SOZCUK.has(s)) konu++;
  return konu >= 3;
}

/**
 * AVUKATIN KENDİ KÜNYESİ SİLİNMESİN (08.10.2026).
 *
 * BULUNAN KUSUR (iki denetçi ayrı ayrı buldu, kod yolu doğrulandı). Havuzda
 * olmayan ve mahkemesi okunamayan ('') her künye Bedesten'in YARGITAY
 * aramasında aranıyor, bulunamazsa "uydurma" sayılıp metinden SİLİNİYORDU.
 * Oysa temyiz dilekçesindeki "Ankara 5. Asliye Hukuk Mahkemesi'nin 2025/123
 * E., 2025/456 K. sayılı kararı" bir ilk derece kararıdır; Yargıtay'da
 * olamaz. Aynısı Düzelt'te avukatın kendi yazdığı künyeye, belge incelemede
 * belgenin kendi esas/karar numarasına oluyordu.
 *
 * Canlıda aranıp yoksa SİLİNEBİLECEK künye yalnız şudur: mahkemesi Yargıtay
 * ya da yazılmamış, kullanıcının verdiği metinde geçmiyor ve hemen önünde
 * ilk derece/istinaf mahkemesi adı yok. Diğerleri silinmez; havuzda yoksa
 * yalnız işaretlenir (sarı).
 */
const sayi = (y: number, n: string) => (y ? `${y}/${n}` : '');

export function kaynaktaGeciyor(a: KararAtif, kaynak: string): boolean {
  if (!kaynak) return false;
  const k = kaynak.replace(/\s*\/\s*/g, '/');
  return [sayi(a.esasYil, a.esasNo), sayi(a.kararYil, a.kararNo)]
    .filter(Boolean)
    .some((no) => new RegExp(`(?<!\\d)${no.replace('/', '\\/')}(?!\\d)`).test(k));
}

const YEREL_MAHKEME =
  /(asliye|sulh|icra|ağır ceza|tüketici|iş mahkemesi|aile mahkemesi|bölge adliye|istinaf|\bbam\b|idare mahkemesi|vergi mahkemesi|müdürlüğü|kadastro|ticaret mahkemesi|fikri ve sınai|çocuk mahkemesi)/;

export function yerelMahkemeBaglami(metin: string, a: KararAtif): boolean {
  const i = metin.replace(/\s+/g, ' ').indexOf(a.ham);
  if (i < 0) return false;
  const pencere = metin.replace(/\s+/g, ' ').slice(Math.max(0, i - 120), i).toLocaleLowerCase('tr');
  return YEREL_MAHKEME.test(pencere);
}

export function canliTeyideUygun(metin: string, a: KararAtif, kaynak = ''): boolean {
  if (a.mahkeme !== '' && a.mahkeme !== 'Yargıtay') return false;
  if (kaynaktaGeciyor(a, kaynak)) return false;
  if (a.mahkeme === '' && yerelMahkemeBaglami(metin, a)) return false;
  return true;
}
