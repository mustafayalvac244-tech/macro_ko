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
