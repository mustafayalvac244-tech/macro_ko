// SOHBET GEÇMİŞİNİ ÖNBELLEĞE AL — saf, içe aktarma YOK (vitest de sınasın).
//
// ÖLÇÜLEN SORUN (03.10.2026, canlı ai_istek): sohbette soru başı ortalama girdi
// 17.900 token, maliyet ₺2,20 — 16.09'daki tek soruluk ölçümün (₺0,64) 3,4 katı.
// Model hafızasız olduğu için önceki konuşma her soruda yeniden gönderilir
// (zorunlu); ama yalnız sabit sistem talimatı önbellekteydi, geçmiş her soruda
// tam fiyattan okunuyordu.
//
// İKİ ENGEL VARDI:
//  1. Araştırma dosyası (kural + mevzuat + içtihat) SİSTEM bölümündeydi ve her
//     soruda değişir. Önbellek ÖNEK eşleşmesiyle çalışır; değişen sistem bölümü,
//     arkasındaki bütün geçmişin önbelleğini her soruda bozuyordu. Çok turlu
//     sohbette dosya son kullanıcı mesajının başına taşınır.
//  2. Mesajlarda kesme noktası yoktu. Son ASİSTAN cevabına konur: bir sonraki
//     soruda [sistem + o ana kadarki konuşma] önbellekten (~0,1 fiyat) okunur;
//     yalnız yeni soru ve dosyası tam fiyattır.
//
// Tek mesajlı işler (dilekçe, mütalaa, belge) DEĞİŞMEZ: dosya sistemde kalır.

export type GirisMesaji = { role: 'user' | 'model'; text: string };
type Blok = { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } };
export type ApiMesaji = { role: 'user' | 'assistant'; content: string | Blok[] };

export function mesajlariHazirla(
  msgs: GirisMesaji[],
  dosya: string
): { mesajlar: ApiMesaji[]; dosyaSistemde: boolean; mesajKesmesi: boolean } {
  const mesajlar: ApiMesaji[] = msgs.map((m) => ({
    role: m.role === 'model' ? 'assistant' : 'user',
    content: m.text,
  }));
  const cokTurlu = msgs.length >= 3;
  if (!cokTurlu) return { mesajlar, dosyaSistemde: true, mesajKesmesi: false };

  // Kesme noktası: sondan ikinci mesaj (son asistan cevabı) — boş değilse.
  let mesajKesmesi = false;
  const i = mesajlar.length - 2;
  const onceki = mesajlar[i];
  if (onceki.role === 'assistant' && typeof onceki.content === 'string' && onceki.content.trim()) {
    mesajlar[i] = { role: 'assistant', content: [{ type: 'text', text: onceki.content, cache_control: { type: 'ephemeral' } }] };
    mesajKesmesi = true;
  }

  // Değişen dosya son kullanıcı mesajının başına: geçmişin öneki sabit kalsın.
  const son = mesajlar[mesajlar.length - 1];
  if (dosya.trim() && son.role === 'user' && typeof son.content === 'string') {
    mesajlar[mesajlar.length - 1] = {
      role: 'user',
      content: [
        { type: 'text', text: `[BU SORU İÇİN ARAŞTIRMA DOSYASI — yalnız buna dayan]\n${dosya.trim()}` },
        { type: 'text', text: son.content },
      ],
    };
    return { mesajlar, dosyaSistemde: false, mesajKesmesi };
  }
  return { mesajlar, dosyaSistemde: true, mesajKesmesi };
}
