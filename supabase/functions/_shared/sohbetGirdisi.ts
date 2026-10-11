// SOHBET GİRDİSİ — UZUNLUK TAVANI (10.10.2026, 50 denetçi bulgusu 23). Saf, testli.
// ---------------------------------------------------------------------------
// BULUNAN KUSUR. ai-chat sohbet moduna gelen `messages` yalnız `.slice(-30)`
// ile kesiliyordu: her mesaj sınırsız uzunlukta olabilirdi. Tek bir istek
// yüz binlerce token'lık Claude girdisine dönüşebilir; hak da istek BAŞLAMADAN
// ayrıldığından kötüye kullanımın tek freni aylık ₺ tavanıydı.
//
// SAYILAR ÖLÇÜLMEDİ, TAHMİN. Bir ürün sınırı, ölçüm sonucu değil:
//   • SOHBET_MESAJ_MAX = 12.000: belge inceleme ekranının yapıştırma tavanıyla
//     (app/document-review.tsx > MAX_CHARS) aynı. Uzun metin zaten orada
//     inceleniyor; sohbet soruları ve model cevapları bunun çok altında.
//   • SOHBET_TOPLAM_MAX = 60.000: bir isteğin en çok ~5 tam mesajı taşıması.
//     30 mesaj × 12.000 = 360.000 karakter (yüzlerce bin token) olurdu.
// İkisi de TEK YERDE; değiştirmek ürün kararıdır.
//
// DAVRANIŞ.
//   • SON mesaj (bu turun sorusu) tavanı aşarsa istek REDDEDİLİR. Sessizce
//     kesip yarım soruyu cevaplamak, avukata yanlış sorunun cevabını verirdi.
//   • ESKİ mesajlar (geçmiş bağlamdır) kısaltılır; toplam tavanı aşınca en
//     eski mesajlar atılır — istemci de zaten son 30'u gönderir.
//   • Rol 'model' değilse 'user' sayılır: istemciden gelen bir 'system' rolü
//     sağlayıcıya geçemez.
//   • Yayındaki 3.4.0 istemcisi bu sınırların çok altında gönderir; normal bir
//     konuşma bu fonksiyondan aynen çıkar.

export const SOHBET_MESAJ_MAX = 12_000;
export const SOHBET_TOPLAM_MAX = 60_000;
const SOHBET_AZAMI_MESAJ = 30;

export interface SohbetMesaji {
  role: 'user' | 'model';
  text: string;
}

export function sohbetMesajlari(ham: unknown): { mesajlar: SohbetMesaji[] } | { hata: 'girdi_buyuk' } {
  if (!Array.isArray(ham)) return { mesajlar: [] };

  let mesajlar: SohbetMesaji[] = ham.slice(-SOHBET_AZAMI_MESAJ).map((x) => {
    const o = (x ?? {}) as { role?: unknown; text?: unknown };
    return { role: o.role === 'model' ? 'model' : 'user', text: typeof o.text === 'string' ? o.text : '' } as SohbetMesaji;
  });

  const son = mesajlar[mesajlar.length - 1];
  if (son && son.text.length > SOHBET_MESAJ_MAX) return { hata: 'girdi_buyuk' };
  mesajlar = mesajlar.map((m) => (m.text.length > SOHBET_MESAJ_MAX ? { ...m, text: m.text.slice(0, SOHBET_MESAJ_MAX) } : m));

  // Toplam tavan: en eski mesajlar atılır, son mesaj her zaman kalır.
  let toplam = mesajlar.reduce((a, m) => a + m.text.length, 0);
  while (mesajlar.length > 1 && toplam > SOHBET_TOPLAM_MAX) {
    toplam -= mesajlar[0]!.text.length;
    mesajlar = mesajlar.slice(1);
  }
  // Anthropic ilk mesajın 'user' olmasını ister (bkz. src/utils/sohbetGecmisi.ts).
  const ilkKullanici = mesajlar.findIndex((m) => m.role === 'user');
  if (ilkKullanici > 0) mesajlar = mesajlar.slice(ilkKullanici);

  return { mesajlar };
}
