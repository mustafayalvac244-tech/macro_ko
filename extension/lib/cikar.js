/**
 * YEREL ÇIKARICI — sunucuya sormadan, anında, bedava.
 *
 * NEDEN AI DEĞİL. İlk sürüm sayfa metnini sunucudaki `kunye` ucuna yolluyordu.
 * Bu fazla mühendislikti: "Esas No: 2023/145", "Ankara 3. Asliye Hukuk
 * Mahkemesi", "DAVALI:" gibi ifadeler sayfada DÜZ YAZIYLA duruyor. Bunları
 * çıkarmak için modele ihtiyaç yok; düzenli ifade yeter ve üstünlükleri açık:
 *
 *   • anında (ağ turu yok)          • bedava (token yok)
 *   • kota harcamaz                 • API anahtarı gerektirmez
 *   • deterministik ve testli       • çevrimdışı çalışır
 *
 * SEÇİCİ DEĞİL, METİN. Yine de CSS/XPath seçicisi kullanmıyoruz: UYAP arayüzünü
 * değiştirdiğinde seçiciler sessizce boşalır. Metin kalıpları ise ekranda görünen
 * yazıya bakar; başlık nereye taşınırsa taşınsın "Esas No" yazısı orada durur.
 *
 * BULAMAZSA UYDURMAZ. Alan yoksa null döner. Yanlış bir esas numarasıyla dosya
 * kurmak, eksik dosyadan pahalıdır: dolu görünür, kimse bir daha bakmaz.
 */

/**
 * UZUNLUĞU KORUYAN KÜÇÜLTME — Türkçe 'İ' tuzağı için.
 *
 * BULUNAN KUSUR: JavaScript'te /mahkemesi/i deseni "MAHKEMESİ" ile EŞLEŞMEZ.
 * Sebep, 'İ' (U+0130) harfinin basit kat kurallarında 'i' + birleşik noktaya
 * inmesi; `i` bayrağı bunu görmez. UYAP mahkeme adını büyük harfle yazdığı için
 * alan sürekli boş kalıyordu.
 *
 * toLocaleLowerCase('tr-TR') de çözmez: 'İ' iki karaktere dönüşüp DİZİN
 * KAYDIRIR ve orijinal metinden doğru parçayı kesemeyiz. Bu yüzden birebir
 * karakter eşlemesi yapıyoruz — uzunluk aynı kalıyor, dizinler geçerli kalıyor.
 */
const KUCUK = { 'İ': 'i', 'I': 'ı', 'Ş': 'ş', 'Ğ': 'ğ', 'Ü': 'ü', 'Ö': 'ö', 'Ç': 'ç' };
export function kucult(v) {
  let s = '';
  for (const h of v ?? '') s += KUCUK[h] ?? (h >= 'A' && h <= 'Z' ? h.toLowerCase() : h);
  return s;
}

/** Etiketten sonra gelen değeri alır: "Esas No : 2023/145" -> "2023/145" */
function etiketliDeger(metin, etiketler, desen, tekSatir = false) {
  const k = kucult(metin); // dizinler orijinalle birebir
  // tekSatir: serbest metin alanlarında (dava türü) etiket ile değer AYNI
  // satırda olmalı. "Dava Türü :\nESAS NO : 2023/145" eskiden dava türü
  // "ESAS NO : 2023/145" çıkıyordu (08.10.2026, denetçi ölçtü).
  const ara = tekSatir ? '[ \\t]*' : String.raw`\s*`;
  for (const etiket of etiketler) {
    const r = new RegExp(etiket + ara + '[:\\-]?' + ara + '(' + desen + ')');
    const m = r.exec(k);
    if (m?.[1]) return metin.slice(m.index + m[0].length - m[1].length, m.index + m[0].length).trim();
  }
  return null;
}

// (?!\d): "2023/1234567" eskiden SESSİZCE "2023/123456" olarak kesiliyordu;
// artık 6 haneden uzun sıra numarası hiç eşleşmez (yanlış numara yerine boş).
const DOSYA_NO = String.raw`\d{4}\s*/\s*\d{1,6}(?!\d)`;

/** "2023/145" biçimini tek boşluksuz hâle getirir. */
function noDuzelt(v) {
  return v ? v.replace(/\s+/g, '') : null;
}

export function esasNo(metin) {
  return noDuzelt(
    etiketliDeger(metin, ['esas\\s*no', 'dosya\\s*no', 'esas'], DOSYA_NO) ||
      // "2023/145 E." biçimi (numara önce, etiket sonra)
      (new RegExp('(' + DOSYA_NO + String.raw`)\s*E\.`, 'i').exec(metin)?.[1] ?? null)
  );
}

export function kararNo(metin) {
  return noDuzelt(
    etiketliDeger(metin, ['karar\\s*no'], DOSYA_NO) ||
      (new RegExp('(' + DOSYA_NO + String.raw`)\s*K\.`, 'i').exec(metin)?.[1] ?? null)
  );
}

/**
 * Mahkeme adı. "… Mahkemesi" / "… Müdürlüğü" ile biten satırı arar; başındaki
 * il ve numarayı da alır ("Ankara 3. Asliye Hukuk Mahkemesi").
 */
export function mahkeme(metin) {
  // BÜYÜK HARF ŞART DEĞİL. İlk kalıp baş harfi büyük, gerisi küçük bir ad
  // bekliyordu; UYAP mahkeme adını BÜYÜK HARFLE yazar ("ANKARA 3. ASLİYE HUKUK
  // MAHKEMESİ") ve alan boş kalıyordu. Artık anahtar sözcüğü bulup AYNI SATIRDA
  // ondan önceki sözcükleri topluyoruz; büyük/küçük harf önemsiz.
  //
  // 08.10.2026 (denetçi ölçtü): "MAHKEMESİ : ANKARA 3. ASLİYE HUKUK
  // MAHKEMESİ" satırında İLK anahtar satır başındaki etiketti ve ad
  // "MAHKEMESİ" çıkıyordu; esas no da bulununca yapay zekâya hiç
  // sorulmuyordu. "DAVALI : Çankaya Vergi Dairesi" satırı mahkeme sanılıyordu.
  // Artık: taraf satırları atlanır, SON anahtar alınır, iki noktadan önceki
  // etiket ve dosya numaraları atılır, anahtardan önce en az bir ad sözcüğü
  // şarttır.
  const anahtar = /(mahkemesi|müdürlüğü|dairesi|başkanlığı)/g;
  const tarafSatiri = /^\s*(davac|daval|vekil|alacakl|borçlu|bor[cç]lu|sanık|san[ıi]k|müşteki|katılan|karşı\s*taraf|müdahil)/;
  for (const satir of (metin ?? '').split(/[\n\r]+/)) {
    const k = kucult(satir);
    if (tarafSatiri.test(k)) continue;
    let son = null;
    for (const m of k.matchAll(anahtar)) son = m;
    if (!son) continue;
    let once = satir.slice(0, son.index);
    const ikiNokta = once.lastIndexOf(':');
    if (ikiNokta >= 0) once = once.slice(ikiNokta + 1);
    const anahtarMetni = satir.slice(son.index, son.index + son[1].length);
    // "T.C." başlığını ve dosya numaralarını at, son 8 sözcüğü al ("İSTANBUL
    // BÖLGE ADLİYE MAHKEMESİ 14. HUKUK DAİRESİ" daireyle birlikte kalsın).
    const sozcukler = once
      .split(/\s+/)
      .filter((x) => x && !/^t\.?c\.?$/i.test(x) && !/^\d{4}\/\d+/.test(x) && !/^(esas|no|e\.|k\.)$/i.test(x));
    if (!sozcukler.some((x) => /\p{L}{2,}/u.test(x))) continue;
    const ad = [...sozcukler.slice(-8), anahtarMetni].join(' ').replace(/\s+/g, ' ').trim();
    if (ad.length >= 8) return ad;
  }
  return null;
}

/** Taraf adı: "DAVALI: Ahmet Yılmaz" — satır sonuna ya da 60 karaktere kadar. */
function taraf(metin, etiketler) {
  const k = kucult(metin);
  for (const etiket of etiketler) {
    // Etiketle değer AYNI satırda: "DAVACI :\nDAVALI :" eskiden davacıyı
    // "DAVALI :" yapıyordu.
    const r = new RegExp(etiket + String.raw`[ \t]*[:\-][ \t]*([^\n\r]{2,60})`);
    const m = r.exec(k);
    if (m?.[1]) {
      const ham = metin.slice(m.index + m[0].length - m[1].length, m.index + m[0].length);
      const ad = ham
        .replace(/\s{2,}.*$/, '')            // ikinci sütuna taşmayı kes
        .replace(/\s*(?:vekili|adına)\b.*$/i, '')
        // KİMLİK NUMARASI BAŞLIĞA GİRMESİN: 11 haneli sayı ve önündeki
        // "(TC:" / "T.C. Kimlik No" kesilir. "T.C. Ziraat Bankası" gibi
        // adın PARÇASI olan T.C. korunur (eskiden ad tümüyle siliniyordu).
        .replace(/[\s,(]*(?:T\.?\s?C\.?\s*(?:kimlik\s*)?(?:no\.?|numaras[ıi])?\s*[:.]?\s*)?\d{11}\b.*$/i, '')
        .replace(/[\s,(]*\bT\.?\s?C\.?\s*(?:kimlik\s*)?(?:no\.?|numaras[ıi])?\s*:?\s*$/i, '')
        .replace(/[\s(,\-–]+$/, '')
        .trim();
      if (ad.length >= 3) return ad;
    }
  }
  return null;
}

export const davaci = (m) => taraf(m, ['davac[ıi]', 'alacakl[ıi]', 'm[üu]şteki', 'katılan']);
export const davali = (m) => taraf(m, ['daval[ıi]', 'bor[çc]lu', 'san[ıi]k', 'karş[ıi]\\s*taraf']);

/** "Dava Türü: Alacak" / "Dava Konusu: …" */
export function davaTuru(metin) {
  const v = etiketliDeger(metin, ['dava\\s*t[üu]r[üu]', 'dava\\s*konusu', 'i[şs]in\\s*konusu'], '[^\\n\\r]{3,60}', true);
  // İki sütunlu tabloda ikinci sütun taşıyordu: "Alacak          Dava Değeri: …"
  return v ? v.replace(/\s{2,}.*$/, '').trim() || null : null;
}

/** GG.AA.YYYY -> YYYY-AA-GG. Sadece bilinen etiketlerin yanındaki tarihi alır. */
export function durusmaTarihi(metin) {
  const v = etiketliDeger(
    metin,
    // "Sonraki duruşma" ÖNCE: tutanakta geçmiş duruşmanın tarihi de yazar.
    ['sonraki\\s*duru[şs]ma(?:\\s*(?:tarihi|g[üu]n[üu]))?', 'duru[şs]ma\\s*(?:tarihi|g[üu]n[üu])'],
    String.raw`\d{1,2}[./]\d{1,2}[./]\d{4}`
  );
  if (!v) return null;
  const [g, a, y] = v.split(/[./]/);
  return `${y}-${a.padStart(2, '0')}-${g.padStart(2, '0')}`;
}

/**
 * Hepsini bir arada çıkarır ve uygulamanın alan adlarına çevirir.
 * Bulunamayan alan null kalır — TAHMİN EDİLMEZ.
 */
export function kunyeCikarYerel(metin) {
  const m = (metin ?? '').replace(/ /g, ' ');
  const esas = esasNo(m);
  const mah = mahkeme(m);
  const dcı = davaci(m);
  const dlı = davali(m);

  // Başlık: "Mahkeme — 2023/145" ya da taraflardan kurulur. Uydurma yok:
  // ikisi de yoksa null döner ve ekran kayıt açtırmaz.
  let baslik = null;
  if (mah && esas) baslik = `${mah} · ${esas}`;
  else if (dcı && dlı) baslik = `${dcı} - ${dlı}`;
  else if (esas) baslik = esas;
  else if (mah) baslik = mah;

  return {
    title: baslik,
    case_number: esas,
    decision_number: kararNo(m),
    court_name: mah,
    case_type: davaTuru(m),
    opposing_party: dlı,
    davaci: dcı,
    davali: dlı,
    hearing_date: durusmaTarihi(m),
  };
}

/** Dolu alan sayısı — "hiç bulunamadı" ile "kısmen bulundu" ayrımı için. */
export function doluSayisi(k) {
  return Object.values(k).filter((v) => typeof v === 'string' && v.trim()).length;
}
