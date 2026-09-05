// DİLEKÇE İSKELETİ VE BELGE TÜRLERİ — saf mantık, testli.
// ---------------------------------------------------------------------------
// NEDEN AYRI DOSYA. Buradaki kod, dilekçenin YAPISINI garanti eden yer:
// zorunlu bölümlerin düşmemesi, künyenin doğru etiketlerle dizilmesi, uydurma
// tarihlerin ayıklanması. Uç işlevinin içindeyken hiçbiri sınanamıyordu —
// çünkü orada Deno'ya özgü şeyler var ve test koşucusu dosyayı içeri alamıyor.
//
// Sınanmayan yer, sessizce bozulan yerdir: on dilekçe türünün beşi aylarca
// yanlış iskeletle diziliyordu (temyiz dilekçesinin başında "HARCA ESAS DAVA
// DEĞERİ" satırı) ve bunu ancak elle okuyunca fark ettik.
//
// Bu dosya Deno API'si KULLANMAZ; hem uç işlevi hem vitest içeri alabilsin.

/**
 * Merci satırı türe göre değişir ve yanlış yazmak dilekçeyi yanlış yere
 * gönderir. Ölçülen arıza: istinaf dilekçesi yalnız ilk derece mahkemesini
 * yazdı; oysa istinaf, BAM'a hitaben yazılıp kararı veren mahkemeye sunulur.
 */
export function mahkemeTarifi(tip: string): string {
  if (tip === 'istinaf')
    return 'İKİ SATIR: önce "… BÖLGE ADLİYE MAHKEMESİ İLGİLİ HUKUK DAİRESİNE", ' +
      'altına "Sunulmak üzere … MAHKEMESİ SAYIN HÂKİMLİĞİNE"';
  if (tip === 'temyiz')
    return 'İKİ SATIR: önce "YARGITAY İLGİLİ HUKUK DAİRESİNE", altına ' +
      '"Sunulmak üzere … BÖLGE ADLİYE MAHKEMESİ … HUKUK DAİRESİ BAŞKANLIĞINA"';
  if (tip === 'itiraz') return 'yalnız icra dairesinin adı (itiraz mahkemeye değil, İCRA DAİRESİNE yapılır)';
  if (tip === 'ihtarname') return 'noter adı ya da "… NOTERLİĞİNE"';
  // Ara dilekçeler DERDEST dosyaya sunulur: yeni bir merci aranmaz, davanın
  // görüldüğü mahkemeye hitap edilir ve esas numarası künyede yer alır.
  if (tip === 'replik' || tip === 'duplik' || tip === 'islah' || tip === 'bilirkisi')
    return 'davanın görüldüğü mahkeme (örn. "ANKARA 3. ASLİYE HUKUK MAHKEMESİ SAYIN HÂKİMLİĞİNE")';
  return 'yalnız merci adı (örn. "ANKARA NÖBETÇİ SULH HUKUK MAHKEMESİ")';
}

/** Modele hangi blokları yazacağını, iskeletten türeterek söyler. */
export function bloklarTarifi(tip: string): string {
  const i = iskeletSec(tip);
  const satir = [`###MAHKEME###  (${mahkemeTarifi(tip)})`];
  satir.push(
    '###TARAF###  (aşağıdaki etiketlerden OLAYDA GEÇENLERİ "ETİKET: değer" biçiminde yaz; ' +
      'olayda geçmeyeni HİÇ YAZMA — boşluğu biz koyarız)\n' +
      i.taraflar.map(([e]) => `        ${e}:`).join('\n')
  );
  for (const b of i.bolumler) satir.push(`###${b.anahtar}###  (${b.baslik})`);
  satir.push('###KONTROL###  (avukatın denetlemesi gereken boşluklar, süreler, riskler)');
  return satir.join('\n');
}

/**
 * DİLEKÇE İSKELETİ KODDA KURULUR; MODEL YALNIZ İÇERİK YAZAR.
 *
 * ÖLÇÜLEN SORUN: aynı istek iki koşuda iki farklı YAPI üretti. Birinde
 * "NETİCE-İ TALEP" vardı, diğerinde hiç yoktu; harca esas dava değeri (HMK
 * m.119/1-d, zorunlu unsur) ikisinde de yoktu. Talimatla tutarlılık istenemez:
 * model kuralı çoğu zaman tutar, tutmadığı sefer avukat mahkemeden dilekçe
 * ihtarı alır ve zaman kazanmak yerine kaybeder.
 *
 * Bu yüzden zorunlu unsurlar modele BIRAKILMIYOR. Model her bölümü işaretli
 * blok hâlinde yazar (###KONU### gibi), dilekçeyi kod dizer. Bir bölüm hiç
 * gelmediyse yerine doldurulacak bir boşluk konur — sessizce düşmez.
 *
 * Taraf blokları da kodda üretilir: "DAVALI" satırına "[Davacı Ad-Soyad]"
 * yazılması gibi bir hata artık yapısal olarak mümkün değildir.
 */
export interface DilekceBolum {
  anahtar: string;
  baslik: string;
  zorunlu: boolean;
  /** Bölüm gelmezse yerine yazılacak boşluk. */
  bosluk?: string;
}

export interface DilekceIskelet {
  /** Taraf satırlarının etiketleri; türden türe değişir. */
  taraflar: Array<[string, string]>;
  bolumler: DilekceBolum[];
}

export const ORTAK_SON: DilekceBolum[] = [
  { anahtar: 'SEBEPLER', baslik: 'HUKUKİ SEBEPLER', zorunlu: true, bosluk: '[Hukuki sebepler — doldurun]' },
  { anahtar: 'DELILLER', baslik: 'DELİLLER', zorunlu: true, bosluk: '[Deliller — doldurun]' },
  { anahtar: 'TALEP', baslik: 'NETİCE-İ TALEP', zorunlu: true, bosluk: '[Netice-i talep — doldurun]' },
];

// DAVALININ KİMLİK NUMARASI ZORUNLU DEĞİLDİR. HMK m.119/1-b taraflar için
// yalnız "adı, soyadı ve adresleri"ni arar; kimlik numarasını (c bendi)
// SADECE DAVACI için ister. Davalı satırına da TCKN boşluğu koymak, kanunun
// istemediği bir bilgiyi eksikmiş gibi gösteriyordu: taslak olduğundan daha
// yarım görünüyor ve avukat bulamayacağı bir numarayı arıyordu.
export const DAVA_TARAF: Array<[string, string]> = [
  ['DAVACI', '[Davacı ad-soyad] — T.C. [Davacı TCKN] — [Davacı adres]'],
  ['VEKİLİ', 'Av. [Vekil ad-soyad] — [Vekil adres]'],
  ['DAVALI', '[Davalı ad-soyad] — [Davalı adres]'],
];

export const DILEKCE_ISKELET: Record<string, DilekceIskelet> = {
  dava: {
    taraflar: DAVA_TARAF,
    bolumler: [
      { anahtar: 'KONU', baslik: 'KONU', zorunlu: true, bosluk: '[Dava konusu — doldurun]' },
      // HMK m.119/1-d: dava değeri zorunlu unsurdur; eksikliği dilekçe ihtarına
      // yol açar. İlk ölçümde iki taslakta da yoktu.
      { anahtar: 'DEGER', baslik: 'HARCA ESAS DAVA DEĞERİ', zorunlu: true, bosluk: '[Dava değeri — doldurun] TL' },
      { anahtar: 'ACIKLAMALAR', baslik: 'AÇIKLAMALAR', zorunlu: true, bosluk: '[Vakıalar — doldurun]' },
      ...ORTAK_SON,
    ],
  },
  cevap: {
    taraflar: [
      ['DAVACI', '[Davacı ad-soyad]'],
      ['DAVALI', '[Davalı ad-soyad] — T.C. [Davalı TCKN] — [Davalı adres]'],
      ['VEKİLİ', 'Av. [Vekil ad-soyad] — [Vekil adres]'],
      ['ESAS NO', '[Esas No]'],
    ],
    bolumler: [
      { anahtar: 'KONU', baslik: 'KONU', zorunlu: true, bosluk: '[Cevap konusu — doldurun]' },
      { anahtar: 'USUL', baslik: 'USULE İLİŞKİN İTİRAZLAR', zorunlu: false },
      { anahtar: 'ACIKLAMALAR', baslik: 'AÇIKLAMALAR VE ESASA CEVAPLARIMIZ', zorunlu: true, bosluk: '[Cevaplar — doldurun]' },
      ...ORTAK_SON,
    ],
  },
  istinaf: {
    taraflar: [
      ['İSTİNAF EDEN', '[Ad-soyad] — T.C. [TCKN] — [Adres]'],
      ['VEKİLİ', 'Av. [Vekil ad-soyad] — [Vekil adres]'],
      ['KARŞI TARAF', '[Ad-soyad] — [Adres]'],
      ['KARAR', '[Mahkeme] · [Esas No] · [Karar No] · [Karar tarihi]'],
      ['TEBLİĞ TARİHİ', '[Tebliğ tarihi]'],
    ],
    bolumler: [
      { anahtar: 'KONU', baslik: 'KONU', zorunlu: true, bosluk: '[İstinaf konusu — doldurun]' },
      { anahtar: 'ACIKLAMALAR', baslik: 'İSTİNAF SEBEPLERİ', zorunlu: true, bosluk: '[İstinaf sebepleri — doldurun]' },
      ...ORTAK_SON,
    ],
  },
  itiraz: {
    taraflar: [
      ['İTİRAZ EDEN (BORÇLU)', '[Ad-soyad] — T.C. [TCKN] — [Adres]'],
      ['VEKİLİ', 'Av. [Vekil ad-soyad] — [Vekil adres]'],
      ['ALACAKLI', '[Ad-soyad]'],
      ['DOSYA NO', '[İcra dosya no]'],
    ],
    bolumler: [
      { anahtar: 'KONU', baslik: 'KONU', zorunlu: true, bosluk: '[İtiraz konusu — doldurun]' },
      { anahtar: 'ACIKLAMALAR', baslik: 'İTİRAZ SEBEPLERİMİZ', zorunlu: true, bosluk: '[İtiraz sebepleri — doldurun]' },
      ...ORTAK_SON,
    ],
  },
  ihtarname: {
    taraflar: [
      ['KEŞİDECİ', '[Ad-soyad] — T.C. [TCKN] — [Adres]'],
      ['VEKİLİ', 'Av. [Vekil ad-soyad] — [Vekil adres]'],
      ['MUHATAP', '[Ad-soyad] — [Adres]'],
    ],
    bolumler: [
      { anahtar: 'KONU', baslik: 'KONU', zorunlu: true, bosluk: '[İhtar konusu — doldurun]' },
      { anahtar: 'ACIKLAMALAR', baslik: 'AÇIKLAMALAR', zorunlu: true, bosluk: '[Açıklamalar — doldurun]' },
      { anahtar: 'TALEP', baslik: 'İHTAR VE TALEP', zorunlu: true, bosluk: '[İhtar ve talep — doldurun]' },
    ],
  },
  // ── AŞAĞIDAKİ BEŞ TÜR İSKELETSİZDİ ve sessizce DAVA iskeletiyle diziliyordu.
  //
  // Ekrandaki seçim listesi on tür sunuyor; iskelet beşini tanıyordu. Tanınmayan
  // tür 'dava'ya düşüyordu (iskeletSec) ve sonuç, yapısı yanlış bir belgeydi:
  // temyiz dilekçesinin başına "DAVACI/DAVALI" ve ZORUNLU "HARCA ESAS DAVA
  // DEĞERİ" satırı konuyordu. Islah dilekçesinde esas numarası hiç yoktu.
  //
  // Bu, modelin hatası değil bizim eksiğimizdi: model doğru içeriği yazsa bile
  // kod onu yanlış kalıba diziyordu. Avukatın "hızlandırdı" diyebilmesi için
  // belgenin baştan doğru kalıpta çıkması gerekir; başlığı elle düzeltmek
  // zorunda kaldığı her tür, kazandırdığımız zamanı geri alır.
  //
  // ORTAK İLKE: ikinci dilekçelerde ve ara dilekçelerde ESAS NO vardır ve
  // "harca esas dava değeri" YOKTUR — o, dava dilekçesine özgü unsurdur
  // (HMK m.119/1-d).
  replik: {
    taraflar: [
      ['DAVACI', '[Davacı ad-soyad] — T.C. [Davacı TCKN] — [Davacı adres]'],
      ['VEKİLİ', 'Av. [Vekil ad-soyad] — [Vekil adres]'],
      ['DAVALI', '[Davalı ad-soyad]'],
      ['ESAS NO', '[Esas No]'],
    ],
    bolumler: [
      { anahtar: 'KONU', baslik: 'KONU', zorunlu: true, bosluk: '[Cevaba cevap konusu — doldurun]' },
      { anahtar: 'ACIKLAMALAR', baslik: 'CEVABA CEVAPLARIMIZ', zorunlu: true, bosluk: '[Cevaba cevaplar — doldurun]' },
      ...ORTAK_SON,
    ],
  },
  duplik: {
    taraflar: [
      ['DAVACI', '[Davacı ad-soyad]'],
      ['DAVALI', '[Davalı ad-soyad] — T.C. [Davalı TCKN] — [Davalı adres]'],
      ['VEKİLİ', 'Av. [Vekil ad-soyad] — [Vekil adres]'],
      ['ESAS NO', '[Esas No]'],
    ],
    bolumler: [
      { anahtar: 'KONU', baslik: 'KONU', zorunlu: true, bosluk: '[İkinci cevap konusu — doldurun]' },
      { anahtar: 'ACIKLAMALAR', baslik: 'İKİNCİ CEVAPLARIMIZ', zorunlu: true, bosluk: '[İkinci cevaplar — doldurun]' },
      ...ORTAK_SON,
    ],
  },
  // TEMYİZDE "DELİLLER" BÖLÜMÜ YOKTUR. Temyiz bir hukukilik denetimidir; delil
  // sunulacak yer değildir. ORTAK_SON'u olduğu gibi kullanmak, avukata silmesi
  // gereken bir bölüm bırakırdı.
  temyiz: {
    taraflar: [
      ['TEMYİZ EDEN', '[Ad-soyad] — T.C. [TCKN] — [Adres]'],
      ['VEKİLİ', 'Av. [Vekil ad-soyad] — [Vekil adres]'],
      ['KARŞI TARAF', '[Ad-soyad] — [Adres]'],
      ['TEMYİZ EDİLEN KARAR', '[BAM ... Hukuk Dairesi] · [Esas No] · [Karar No] · [Karar tarihi]'],
      ['TEBLİĞ TARİHİ', '[Tebliğ tarihi]'],
    ],
    bolumler: [
      { anahtar: 'KONU', baslik: 'KONU', zorunlu: true, bosluk: '[Temyiz konusu — doldurun]' },
      { anahtar: 'ACIKLAMALAR', baslik: 'TEMYİZ SEBEPLERİ', zorunlu: true, bosluk: '[Temyiz sebepleri — doldurun]' },
      { anahtar: 'SEBEPLER', baslik: 'HUKUKİ SEBEPLER', zorunlu: true, bosluk: '[Hukuki sebepler — doldurun]' },
      { anahtar: 'TALEP', baslik: 'NETİCE-İ TALEP', zorunlu: true, bosluk: '[Netice-i talep — doldurun]' },
    ],
  },
  bilirkisi: {
    taraflar: [
      ['ESAS NO', '[Esas No]'],
      ['İTİRAZ EDEN', '[Taraf sıfatı: davacı/davalı] [Ad-soyad]'],
      ['VEKİLİ', 'Av. [Vekil ad-soyad] — [Vekil adres]'],
      ['KARŞI TARAF', '[Ad-soyad]'],
      ['RAPOR TEBLİĞ TARİHİ', '[Raporun tebliğ tarihi]'],
    ],
    bolumler: [
      { anahtar: 'KONU', baslik: 'KONU', zorunlu: true, bosluk: '[İtiraz konusu — doldurun]' },
      { anahtar: 'ACIKLAMALAR', baslik: 'RAPORA İTİRAZ SEBEPLERİMİZ', zorunlu: true, bosluk: '[İtiraz sebepleri — doldurun]' },
      { anahtar: 'SEBEPLER', baslik: 'HUKUKİ SEBEPLER', zorunlu: true, bosluk: '[Hukuki sebepler — doldurun]' },
      { anahtar: 'TALEP', baslik: 'SONUÇ VE TALEP', zorunlu: true, bosluk: '[Sonuç ve talep — doldurun]' },
    ],
  },
  islah: {
    taraflar: [
      ['ESAS NO', '[Esas No]'],
      ['ISLAH EDEN', '[Taraf sıfatı: davacı/davalı] [Ad-soyad] — T.C. [TCKN]'],
      ['VEKİLİ', 'Av. [Vekil ad-soyad] — [Vekil adres]'],
      ['KARŞI TARAF', '[Ad-soyad]'],
    ],
    bolumler: [
      { anahtar: 'KONU', baslik: 'KONU', zorunlu: true, bosluk: '[Islah konusu — doldurun]' },
      { anahtar: 'ACIKLAMALAR', baslik: 'ISLAH EDİLEN HUSUSLAR', zorunlu: true, bosluk: '[Islah edilen hususlar — doldurun]' },
      { anahtar: 'SEBEPLER', baslik: 'HUKUKİ SEBEPLER', zorunlu: true, bosluk: '[Hukuki sebepler — doldurun]' },
      { anahtar: 'TALEP', baslik: 'SONUÇ VE TALEP', zorunlu: true, bosluk: '[Sonuç ve talep — doldurun]' },
    ],
  },
};

/**
 * BELGE İNCELEME — tür başına ne aranacağı.
 *
 * Tür ayrımı biçimsel değil: bir sözleşmede aranan şey (aleyhe cezai şart,
 * yetki/tahkim şartı) ile bir kararda aranan şey (süre, hangi kanun yolu)
 * bambaşkadır. Tek bir genel istem, her belgeye aynı soruları sorar ve o
 * belgenin asıl riskini kaçırır.
 *
 * `arama`, besleme sorgusuna eklenen sözcüklerdir: belgenin kendi metni
 * arama sorgusu olduğunda en sık geçen sözcükler kazanır ve ilgisiz mevzuat
 * gelir; bu sözcükler sorguyu doğru kanunlara çeker.
 */
export const BELGE_TURU: Record<string, { ad: string; arama: string; ek: string }> = {
  sozlesme: {
    ad: 'SÖZLEŞME',
    arama: 'sözleşme cezai şart tazminat fesih yetki tahkim',
    ek:
      '\nSÖZLEŞMEDE AYRICA ŞUNLARA BAK: tek taraflı fesih hakkı; aleyhe cezai şart ' +
      '(aşırı ceza hâkim tarafından indirilir); sorumsuzluk kaydı; yetki ve tahkim şartı; ' +
      'ödeme/temerrüt koşulu ve faiz; süre ve yenileme; gizlilik ve rekabet yasağı ' +
      '(süre-yer-konu sınırı var mı); devir yasağı; ekler ve tebligat adresi.',
  },
  dilekce: {
    ad: 'DİLEKÇE',
    arama: 'dilekçe zorunlu unsur netice-i talep deliller harç',
    ek:
      '\nDİLEKÇEDE AYRICA ŞUNLARA BAK: zorunlu unsurlar tam mı (mahkeme, taraflar, ' +
      'harca esas değer, vakıalar, her vakıanın delili, hukuki sebepler, açık talep sonucu, imza); ' +
      'talep sonucu net mi; süre geçmiş mi; yanlış merci ya da yanlış dayanak madde var mı.',
  },
  ihtarname: {
    ad: 'İHTARNAME',
    arama: 'ihtarname temerrüt süre tebligat noter',
    ek:
      '\nİHTARNAMEDE AYRICA ŞUNLARA BAK: muhataba verilen süre açık mı ve yeterli mi; ' +
      'talep miktarı ve dayanağı belirli mi; temerrüt ve faiz uyarısı var mı; ' +
      'aksi hâlde başvurulacak yol yazılı mı; keşideci-muhatap ve adresler tam mı.',
  },
  karar: {
    ad: 'MAHKEME KARARI',
    arama: 'karar gerekçe kanun yolu istinaf temyiz süre tebliğ',
    ek:
      '\nKARARDA AYRICA ŞUNLARA BAK: hangi kanun yolu açık (istinaf/temyiz), süresi ve ' +
      'başlangıcı (tebliğ mi tefhim mi); kesinlik şerhi; hüküm fıkrasında talep karşılanmayan ' +
      'kalem var mı; vekâlet ücreti ve yargılama gideri doğru mu; gerekçe ile hüküm çelişiyor mu.',
  },
  diger: {
    ad: 'BELGE',
    arama: 'belge hukuki risk süre',
    ek: '',
  },
};

/** Türü tanımlı olmayan dilekçeler dava iskeletiyle dizilir. */
export function iskeletSec(tip: string): DilekceIskelet {
  return DILEKCE_ISKELET[tip] ?? DILEKCE_ISKELET.dava;
}

/**
 * Modelin ###ANAHTAR### bloklarını ayrıştırır. JSON yerine işaretli blok
 * kullanılıyor: model bozuk JSON üretebilir ama işaretli blokta en kötü
 * ihtimalle TEK bölüm kaybolur, belge tamamen çöpe gitmez.
 */
export function bloklariAyristir(ham: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /###\s*([A-ZÇĞİÖŞÜ_]+)\s*###/g;
  const isaretler: Array<{ ad: string; bas: number; son: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(ham)) !== null) isaretler.push({ ad: m[1], bas: m.index, son: re.lastIndex });
  for (let i = 0; i < isaretler.length; i++) {
    const bit = i + 1 < isaretler.length ? isaretler[i + 1].bas : ham.length;
    const govde = ham.slice(isaretler[i].son, bit).trim();
    if (govde) out[isaretler[i].ad] = govde;
  }
  return out;
}

/**
 * Etiketi karşılaştırılabilir anahtara indirger. upper()/lower() Türkçe'de
 * güvenilmez (bkz. 0045); önce ASCII'ye çeviriyoruz.
 */
export function etiketAnahtari(e: string): string {
  return e
    .replace(/[İIıŞşĞğÜüÖöÇç]/g, (c) => ({ 'İ': 'I', 'I': 'I', 'ı': 'I', 'Ş': 'S', 'ş': 'S', 'Ğ': 'G', 'ğ': 'G', 'Ü': 'U', 'ü': 'U', 'Ö': 'O', 'ö': 'O', 'Ç': 'C', 'ç': 'C' })[c] ?? c)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/** "###TARAF###" bloğundaki "ETİKET: değer" satırlarını okur. */
export function kunyeAyristir(blok: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const satir of String(blok ?? '').split('\n')) {
    const i = satir.indexOf(':');
    if (i <= 0) continue;
    const deger = satir.slice(i + 1).trim();
    // Modelin "bilinmiyor" demesi bir değer değildir; kodun boşluğu kalsın.
    if (!deger || /^(-|yok|bilinmiyor|belirtilmemi)/i.test(deger)) continue;
    out[etiketAnahtari(satir.slice(0, i))] = deger;
  }
  return out;
}

/**
 * Bölümlerden resmî düzende dilekçe metnini dizer.
 *
 * `dosya`, kullanıcının KENDİ kayıtlarından gelen kesin bilgilerdir (dava,
 * müvekkil, avukat profili) ve künyede modelin yazdığından da ÖNCE gelir:
 * müvekkilin adını en iyi model değil, avukatın kendi kaydı bilir.
 */
export function dilekceyiDiz(
  tip: string,
  bloklar: Record<string, string>,
  dosya: Record<string, string> = {}
): { metin: string; eksik: string[] } {
  const iskelet = iskeletSec(tip);
  const eksik: string[] = [];
  const satirlar: string[] = [];

  // İstinaf/temyizde merci İKİ SATIRDIR ("… BAM … DAİRESİNE" + "Sunulmak üzere
  // … MAHKEMESİNE"); tek satıra indirgemek dilekçeyi yanlış yere gönderir.
  // İSTİNAF/TEMYİZDE DOSYADAKİ MAHKEME ADI KULLANILMAZ: orada merci BAM ya da
  // Yargıtay'dır, kayıttaki mahkeme ise kararı VEREN ilk derece mahkemesidir.
  // Doğrudan yazmak, dilekçeyi yanlış yere gönderirdi.
  const dosyaMerci = tip === 'istinaf' || tip === 'temyiz' ? '' : (dosya.MAHKEME ?? '').trim();
  const mahkeme = dosyaMerci || (bloklar.MAHKEME ?? '').trim();
  satirlar.push(
    mahkeme
      ? mahkeme.split('\n').map((x) => x.trim()).filter(Boolean).join('\n')
      : '[MAHKEME/MERCİ — doldurun]'
  );
  satirlar.push('');

  // KÜNYE SATIRLARINI MODEL DE DOLDURABİLİR. İlk sürümde satırlar hep kodun
  // varsayılan boşluğuyla basılıyordu; olayda "10.06.2026'da tebliğ edildi"
  // yazmasına rağmen TEBLİĞ TARİHİ satırı "[Tebliğ tarihi]" kalıyordu. Sonuç,
  // avukatın elinde bildiği bilgileri yeniden yazması gereken bir boşluk
  // duvarıydı — zaman kazandırmak yerine kaybettiriyordu.
  const kunye = kunyeAyristir(bloklar.TARAF ?? '');
  const etiketGenislik = Math.max(...iskelet.taraflar.map(([e]) => e.length));
  for (const [etiket, varsayilan] of iskelet.taraflar) {
    const anahtar = etiketAnahtari(etiket);
    // ÖNCELİK: avukatın kendi kaydı → modelin yazdığı → kodun boşluğu.
    const deger = (dosya[anahtar] ?? '').trim() || (kunye[anahtar] ?? '').trim() || varsayilan;
    satirlar.push(`${etiket.padEnd(etiketGenislik)} : ${deger}`);
  }
  satirlar.push('');

  for (const b of iskelet.bolumler) {
    const govde = (bloklar[b.anahtar] ?? '').trim();
    if (!govde) {
      if (!b.zorunlu) continue;
      eksik.push(b.baslik);
    }
    satirlar.push(`${b.baslik}`);
    satirlar.push(govde || b.bosluk || '[doldurun]');
    satirlar.push('');
  }

  satirlar.push('Saygılarımla,');
  satirlar.push(dosya.IMZASIFAT ? `${dosya.IMZASIFAT} Vekili` : '[Taraf] Vekili');
  // İmza bloğunda avukatın kendi adı: her taslakta elle yazılan ilk şey buydu.
  satirlar.push(dosya.VEKILI ? dosya.VEKILI.split('—')[0].trim() : 'Av. [Vekil ad-soyad]');
  satirlar.push('');

  const kontrol = (bloklar.KONTROL ?? '').trim();
  if (kontrol) {
    satirlar.push('⚠️ KONTROL LİSTESİ');
    satirlar.push(kontrol);
  }
  return { metin: satirlar.join('\n').replace(/\n{3,}/g, '\n\n').trim(), eksik };
}

/**
 * UYDURULMUŞ TARİHLERİ AYIKLA — modele güvenmeden, mekanik olarak.
 *
 * Talimatı sertleştirmek gerekli ama YETERLİ DEĞİL: model bir kuralı çoğu zaman
 * tutar, bazen tutmaz ve tutmadığı sefer dilekçe mahkemeye yanlış tarihle gider.
 * Burada model devrede değil: taslakta geçip de avukatın anlatısında GEÇMEYEN
 * her gg.aa.yyyy tarihi, doldurulacak bir boşlukla değiştirilir.
 *
 * Yön bilinçli: yanlış tarih göstermektense boşluk göstermek her zaman daha
 * iyidir. Avukat boşluğu görür ve doldurur; yanlış tarihi göremeyebilir.
 *
 * Kanun/karar atıflarındaki tarihler de ayıklanır — dilekçede "18/2/1965-538/37"
 * gibi değişiklik tarihleri işe yaramaz, avukatın verdiği olgular esastır.
 */
export function uydurmaTarihleriAyikla(taslak: string, olay: string): { metin: string; ayiklanan: number } {
  const anahtar = (g: string, a: string, y: string) =>
    `${y}-${a.padStart(2, '0')}-${g.padStart(2, '0')}`;

  const izinli = new Set<string>();
  for (const m of olay.matchAll(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/g)) {
    izinli.add(anahtar(m[1], m[2], m[3]));
  }
  for (const m of olay.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    izinli.add(`${m[1]}-${m[2]}-${m[3]}`);
  }

  let ayiklanan = 0;
  const metin = taslak.replace(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/g, (tam, g, a, y) => {
    if (izinli.has(anahtar(g, a, y))) return tam;
    ayiklanan++;
    return '[tarih — doldurun]';
  });
  return { metin, ayiklanan };
}


/**
 * MÜTALAADA TARİHLER SİLİNMEZ, İŞARETLENİR.
 *
 * Dilekçede olayda geçmeyen her tarih boşlukla değiştiriliyor: dilekçe tarih
 * HESAPLAMA yeri değildir, yanlış tarih mahkemeye gider.
 *
 * Mütalaada durum TERSİNE döner. Avukat oraya "hangi süre ne zaman doluyor"
 * sorusuyla gelir; "fesih 14.04.2026, bir aylık süre 14.05.2026'da doluyor"
 * cümlesi mütalaanın ta kendisidir. Bu tarihleri silmek, özelliğin değerini
 * silmek olurdu.
 *
 * O yüzden burada silme değil İŞARETLEME var: olayda geçmeyen tarihler
 * listelenir ve arayüz "bu tarihler hesaplanmıştır, teyit edin" der. Sessizce
 * doğru kabul ettirmiyoruz, ama işe yarayan bilgiyi de atmıyoruz.
 */
export function hesaplananTarihler(metin: string, olay: string): string[] {
  const anahtar = (g: string, a: string, y: string) => `${y}-${a.padStart(2, '0')}-${g.padStart(2, '0')}`;
  const izinli = new Set<string>();
  for (const m of olay.matchAll(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/g)) izinli.add(anahtar(m[1], m[2], m[3]));
  for (const m of olay.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) izinli.add(`${m[1]}-${m[2]}-${m[3]}`);
  const cikan = new Set<string>();
  for (const m of metin.matchAll(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/g)) {
    if (!izinli.has(anahtar(m[1], m[2], m[3]))) cikan.add(m[0]);
  }
  return [...cikan];
}
