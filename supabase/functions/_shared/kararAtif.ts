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

// "2019/12345 E." · "2020/6789 K." · "2019/123 Esas" · "2020/45 Karar"
// Harf, ardından harf gelirse eşleşmez ("2020/12 Ekim" atıf değildir).
const PARCA =
  /(\d{4})\s*\/\s*([\d()\-–—\s]{1,16}?)\s*(E|K|Esas|Karar)(?![A-Za-zÇĞİÖŞÜçğıöşü])\.?/gi;

/**
 * Metindeki içtihat atıflarını çıkarır.
 *
 * Esas ve karar numarası AYRI yazılır ("2019/12345 E., 2020/6789 K."); ikisi
 * yan yanaysa TEK atıf sayılır. Yalnız esas verilen atıf da geçerlidir ve
 * yaygındır — karar numarası olmadan da UYAP'ta aranabilir.
 */
export function kararAtiflari(metin: string): KararAtif[] {
  const d = String(metin ?? '');
  type Parca = { yil: number; no: string; tur: 'E' | 'K'; bas: number; son: number };
  const parcalar: Parca[] = [];

  PARCA.lastIndex = 0;
  for (const m of d.matchAll(PARCA)) {
    const no = m[2];
    if (!numaraGecerli(no)) continue;
    const harf = m[3].toLocaleUpperCase('tr');
    parcalar.push({
      yil: Number(m[1]),
      no: sadeNumara(no),
      tur: harf.startsWith('E') ? 'E' : 'K',
      bas: m.index ?? 0,
      son: (m.index ?? 0) + m[0].length,
    });
  }

  const cikan: KararAtif[] = [];
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

    cikan.push({
      ham: d.slice(p.bas, (karar ?? p).son).replace(/\s+/g, ' ').trim(),
      mahkeme,
      daireTur,
      daireNo,
      esasYil: p.tur === 'E' ? esas.yil : 0,
      esasNo: p.tur === 'E' ? esas.no : '',
      kararYil: karar ? karar.yil : 0,
      kararNo: karar ? karar.no : '',
    });
  }

  // Aynı atıf metinde birden çok geçebilir; avukata iki kez sormayalım.
  const anahtar = new Set<string>();
  return cikan.filter((a) => {
    const k = `${a.esasYil}/${a.esasNo}#${a.kararYil}/${a.kararNo}`;
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
    const tavan = DAIRE_TAVANI[a.daireTur];
    if (tavan && a.daireNo > tavan) {
      cikan.push({ atif: a, sebep: 'daire_yok' });
      continue;
    }
  }
  return cikan;
}

/** RPC'ye gidecek sade biçim — yalnız havuzda aranabilir alanlar. */
export function havuzSorgusu(atiflar: KararAtif[]): Array<{ esas: string; karar: string }> {
  return atiflar
    .filter((a) => a.esasNo || a.kararNo)
    .map((a) => ({
      esas: a.esasYil ? `${a.esasYil}/${a.esasNo}` : '',
      karar: a.kararYil ? `${a.kararYil}/${a.kararNo}` : '',
    }));
}
