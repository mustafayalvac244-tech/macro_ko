import { describe, expect, it } from 'vitest';
import { davaEkranDurumu, gecersizKimlikMi } from '@/utils/davaEkrani';

/**
 * DOSYA DETAYI — YOK/SİLİNMİŞ KİMLİKLE AÇILINCA BOŞ EKRAN (09.10.2026).
 *
 * Ekran `isLoading || !caseItem` ise yalnız başlık çiziyordu: yükleniyor,
 * kayıt yok ve bağlantı hatası üçü de AYNI boş sayfaydı, üstelik sonsuza dek.
 * Silinmiş bir dosyanın bağlantısı (web yer imi/geri-ileri, başka cihazda
 * silinen dosya, eski arama sonucu) kullanıcıyı açıklamasız boş sayfada
 * bırakıyordu. Önbellekte eski kopyası varsa daha kötüsü: silinmiş dosya
 * varmış gibi görünüyor, yaptığı her değişiklik "kaydedilemedi" alıyordu.
 */
describe('dosya detayı ekran durumu', () => {
  const dava = { id: 'd1', title: 'X' };
  const agHatasi = { message: 'TypeError: Network request failed' };

  it('istek sürerken (veri yok, hata yok) yükleniyor', () => {
    expect(davaEkranDurumu({ kimlik: 'd1', veri: undefined, hata: null })).toBe('yukleniyor');
  });

  it('sunucu "böyle satır yok" dedi (silinmiş ya da başka hesabın) → bulunamadı', () => {
    // maybeSingle: 0 satır → data null, hata yok.
    expect(davaEkranDurumu({ kimlik: 'd1', veri: null, hata: null })).toBe('bulunamadi');
  });

  it('önbellekteki eski kopya yenilemede null döndüyse → bulunamadı (hayalet dosya gösterilmez)', () => {
    // React Query başarılı yenilemede veriyi null ile değiştirir.
    expect(davaEkranDurumu({ kimlik: 'd1', veri: null, hata: null })).not.toBe('hazir');
  });

  it('bozuk kimlik (uuid değil, Postgres 22P02) → bulunamadı, tekrar denenmez', () => {
    const hata = { code: '22P02', message: 'invalid input syntax for type uuid: "abc"' };
    expect(gecersizKimlikMi(hata)).toBe(true);
    expect(davaEkranDurumu({ kimlik: 'abc', veri: undefined, hata })).toBe('bulunamadi');
  });

  it('ilk yüklemede ağ hatası → yüklenemedi (tekrar dene gösterilir), boş sayfa değil', () => {
    expect(gecersizKimlikMi(agHatasi)).toBe(false);
    expect(davaEkranDurumu({ kimlik: 'd1', veri: undefined, hata: agHatasi })).toBe('yuklenemedi');
  });

  it('önbellekte kopya varken arka plandaki yenileme düşerse ekran açık kalır (çevrimdışı kullanım)', () => {
    expect(davaEkranDurumu({ kimlik: 'd1', veri: dava, hata: agHatasi })).toBe('hazir');
  });

  it('kimliksiz rota → bulunamadı (sonsuz yükleniyor değil)', () => {
    expect(davaEkranDurumu({ kimlik: undefined, veri: undefined, hata: null })).toBe('bulunamadi');
  });
});
