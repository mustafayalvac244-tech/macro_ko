// BESLENEN KURAL ATLANDI MI? — saf mantık, testli.
// ---------------------------------------------------------------------------
// ÖLÇÜLEN ARIZA (mütalaa koşusu, beş senaryonun ikisi). İkisi de KORPUS EKSİĞİ
// DEĞİLDİ — doğru kural havuzda vardı, aramada çıkıyordu, dosyaya giriyordu;
// model onu yok saydı:
//
//   • ise_iade kuralı "TEBLİĞDEN İTİBAREN 1 AY içinde ARABULUCUYA başvurmak
//     zorundadır (dava şartı)" diyor. Model "4 hafta içinde dava açın" yazdı,
//     arabuluculuktan hiç söz etmedi. Arabulucuya gidilmeden açılan dava
//     usulden reddedilir: tavsiyeye uyan avukat için doğrudan hak kaybı.
//   • trafik_zamanasimi kuralı, kaza suç da oluşturuyorsa CEZA zamanaşımının
//     (daha uzun) uygulanacağını söylüyor. Model yalnız iki yılı yazdı.
//
// İstem zaten "her kuralın etkisini açıkça yaz, sessizce atlama" diyor; talimat
// tutmadı. Küçük modelde koşudan koşuya değişiyor. Talimatla gideremiyoruz ama
// ATLANDIĞINI GÖREBİLİYORUZ.
//
// YALNIZ UYARI ÜRETİR, hak düşürmez. Arama en iyi üç kuralı getiriyor ve
// üçüncüsü konuyla teğet olabilir (ölçümde "işe iade" sorgusuna 'mesafeli
// cayma' üçüncü sırada geldi); teğet bir kuralın terimi geçmedi diye çalışan
// bir mütalaayı kusurlu saymak, düzeltmeye çalıştığımız şeyden çok zarar
// verirdi. Karar avukatın: uyarıyı görür, haksız bulursa hakkını geri alır.
//
// Deno API'si KULLANMAZ; hem uç işlevi hem vitest içeri alabilsin.

export interface KuralTerim {
  id: string;
  /** '|' ile ayrılmış seçenekler içerebilir; herhangi biri yeterlidir. */
  zorunlu_terimler?: string[] | null;
}

/**
 * Dosyaya giren kurallardan, cevapta İZİ BULUNMAYANLARI döner.
 *
 * Karşılaştırma Türkçe küçük harfe indirgenerek yapılır. JS'in /i bayrağı
 * 'İ' (U+0130) harfini 'i'ye katlamaz; bu yüzden düzenli ifade değil,
 * toLocaleLowerCase('tr') + includes kullanılıyor.
 */
export function atlananKurallar(kurallar: KuralTerim[], metin: string): string[] {
  const sade = String(metin ?? '').toLocaleLowerCase('tr');
  const atlanan: string[] = [];
  for (const k of kurallar) {
    const gruplar = (k.zorunlu_terimler ?? []).filter((t) => String(t ?? '').trim());
    if (!gruplar.length) continue;
    for (const grup of gruplar) {
      const secenekler = grup.split('|').map((s) => s.trim().toLocaleLowerCase('tr')).filter(Boolean);
      if (!secenekler.length) continue;
      if (!secenekler.some((s) => sade.includes(s))) {
        // Uyarı, terimin KENDİSİNİ söyler: avukat neyin eksik olduğunu
        // kural kimliğinden değil, doğrudan sözcükten anlar.
        atlanan.push(secenekler[0]);
      }
    }
  }
  return [...new Set(atlanan)];
}

/**
 * ALTERNATİF KURALLARIN İKİSİ BİRDEN DAYANAK GÖSTERİLDİ Mİ?
 *
 * ÖLÇÜLEN ARIZA (dilekçe modu, gerçek kullanım denemesi): kira tahliye
 * senaryosunda dosyaya iki kural birden girdi — kira_temerrut_tahliye (TBK
 * m.315, tek ihtarla temerrüt) ve iki_hakli_ihtar_tahliye (TBK m.352/2, bir
 * kira yılında AYRI İKİ ihtar). Kuralın kendi metni bunların "birbirinin
 * ALTERNATİFİ" olduğunu ve "olaydaki ihtarların hangi amaçla çekildiğine
 * bak" dediğini söylüyor. Olayda TEK ihtar vardı; doğru dayanak yalnız
 * temerrüttü.
 *
 * Modele "alternatif kuralları ayırt et, şartı sağlanmayanı ANMA" talimatı
 * eklendi (buildRules). Talimat TUTARSIZ çalıştı: art arda iki bağımsız
 * üretimde biri doğru ayrımı yaptı (yalnız kontrol listesinde "bu şart
 * karşılanmıyor" diye doğru uyarı verdi), diğeri YİNE iki dayanağı birlikte
 * yazdı — hatta olayı "iki haklı ihtar" diye yanlış nitelendirdi. Kanun yolu
 * talebinde gördüğümüzle aynı sınıf: küçük ücretsiz modelde talimat koşudan
 * koşuya değişiyor, talimatla TAM giderilemiyor.
 *
 * Bu yüzden ATLANAN KURAL denetiminin (yukarıdaki) TERSİ bir mekanik denetim
 * gerekiyor: kural "atlanmadı", tam tersine BİRLİKTE kullanıldı ve bu
 * birliktelik kuralların kendi tanımına göre çelişkili. Liste bilerek dar —
 * yalnız BİLİNEN, kuralın kendi metninde "alternatif/AYRI" dediği çiftler.
 * Genel bir "her iki madde numarası birlikte geçerse uyar" yaklaşımı yanlış
 * pozitif üretirdi (iki madde aynı dilekçede meşru şekilde birlikte de geçebilir).
 *
 * YALNIZ UYARI ÜRETİR, hak düşürmez: LLM çıktısı hâlâ tutarsız olabilir, son
 * söz avukatın.
 */
export const CELISEN_KURAL_CIFTLERI: ReadonlyArray<{
  ciftId: [string, string];
  /** Her kuralın metinde dayanak olarak geçtiğini gösteren ayırt edici işaret. */
  isaret: [string, string];
  uyari: string;
}> = [
  {
    ciftId: ['kira_temerrut_tahliye', 'iki_hakli_ihtar_tahliye'],
    isaret: ['315', '352'],
    uyari:
      'Hem TBK m.315 (temerrüt) hem TBK m.352/2 (iki haklı ihtar) dayanak gösterilmiş. ' +
      'Bu ikisi ALTERNATİFTİR: iki haklı ihtar, bir kira yılında AYRI İKİ yazılı ihtarı ' +
      'gerektirir. Olayda kaç ayrı ihtar çekildiğini kontrol edin; yalnız biri geçerliyse ' +
      'diğerini dilekçeden çıkarın.',
  },
];

export function cakisanDayanaklar(kuralIdleri: Set<string>, metin: string): string[] {
  const sade = String(metin ?? '').toLocaleLowerCase('tr');
  const uyarilar: string[] = [];
  for (const c of CELISEN_KURAL_CIFTLERI) {
    if (!kuralIdleri.has(c.ciftId[0]) || !kuralIdleri.has(c.ciftId[1])) continue;
    if (sade.includes(c.isaret[0].toLocaleLowerCase('tr')) && sade.includes(c.isaret[1].toLocaleLowerCase('tr'))) {
      uyarilar.push(c.uyari);
    }
  }
  return uyarilar;
}
