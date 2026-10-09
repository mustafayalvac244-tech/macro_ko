import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { digerOturumlariKapat, sonZiyaretimdenBeriGirenler, type CihazKaydi } from '../src/utils/cihazOturum';

// "YENİ CİHAZDAN GİRİŞ" UYARISI YANLIŞ CİHAZDA ÇIKIYORDU (09.10.2026).
//
// useCihazBildir uyarıyı, cihaz_bildir'in KENDİ cihazı için döndürdüğü
// "yeni" bayrağına bakarak gösteriyordu. Yani uyarı YENİ GİREN cihazda
// çıkıyordu — o cihaz saldırganınsa uyarıyı saldırgan görüyor (ve tek
// dokunuşla "diğer oturumları kapat"a, yani hesap sahibini atmaya
// yönlendiriliyordu); hesap sahibinin cihazları hiçbir şey görmüyordu.
// Özelliğin amacı (0099 göçü: "şifresi ele geçirilen avukatın bunu fark
// etmesi") tam tersini istiyor: uyarı ESKİ cihazda, "sen en son buradayken
// sonra şu cihaz girdi" diye çıkmalı.

const kayit = (anahtar: string, ilk: string, son: string, ad = anahtar): CihazKaydi => ({
  cihaz_anahtari: anahtar,
  ad,
  platform: 'ios',
  ilk_gorulme: ilk,
  son_gorulme: son,
});

describe('sonZiyaretimdenBeriGirenler', () => {
  // A: avukatın telefonu, en son 1 Ekim'de açıldı. B: 5 Ekim'de ilk kez giren cihaz.
  const A = kayit('A', '2026-09-01T08:00:00Z', '2026-10-01T09:00:00Z', 'iPhone');
  const B = kayit('B', '2026-10-05T22:10:00Z', '2026-10-05T22:15:00Z', 'Windows · Chrome');

  it('eski cihaz, kendisinden sonra ilk kez giren cihazı görür', () => {
    expect(sonZiyaretimdenBeriGirenler([A, B], 'A')).toEqual([B]);
  });

  it('yeni giren cihazın KENDİSİNDE uyarı çıkmaz (listede henüz kaydı yok)', () => {
    expect(sonZiyaretimdenBeriGirenler([A], 'B')).toEqual([]);
  });

  it('cihaz en son açıldığından ÖNCE girmiş cihazlar yeniden bildirilmez', () => {
    const eskiB = kayit('B', '2026-09-15T10:00:00Z', '2026-10-05T22:15:00Z');
    expect(sonZiyaretimdenBeriGirenler([A, eskiB], 'A')).toEqual([]);
  });

  it('birden çok yeni cihaz varsa en yenisi başta gelir', () => {
    const C = kayit('C', '2026-10-07T11:00:00Z', '2026-10-07T11:00:00Z');
    expect(sonZiyaretimdenBeriGirenler([A, B, C], 'A').map((c) => c.cihaz_anahtari)).toEqual(['C', 'B']);
  });

  it('bozuk tarih kimseyi uyarmaz (uydurma alarm yok)', () => {
    const bozukA = kayit('A', '2026-09-01T08:00:00Z', 'gecersiz');
    expect(sonZiyaretimdenBeriGirenler([bozukA, B], 'A')).toEqual([]);
  });
});

describe('useCihazBildir listeyi bildirimden ÖNCE okuyup bu yardımcıya veriyor', () => {
  const kanca = readFileSync(join(__dirname, '..', 'src/hooks/useCihazlar.ts'), 'utf8');
  const bas = kanca.indexOf('export function useCihazBildir');
  const govde = kanca.slice(bas, kanca.indexOf('export function useCihazlarim'));

  it('kendi "yeni" bayrağına bakarak uyarmıyor', () => {
    expect(govde).not.toMatch(/s\?\.yeni && !s\.ilk_cihaz/);
    expect(govde).toContain('sonZiyaretimdenBeriGirenler(');
  });

  it('liste okuması cihaz_bildir çağrısından önce (yoksa kendi son görülmesi ezilir)', () => {
    const okuma = govde.indexOf(".from('oturum_cihazlari')");
    const bildir = govde.indexOf("rpc('cihaz_bildir'");
    expect(okuma).toBeGreaterThan(-1);
    expect(bildir).toBeGreaterThan(okuma);
  });
});

// "DİĞER TÜM OTURUMLARI KAPAT" — SIRA (09.10.2026).
//
// Eskiden önce cihaz listesi temizleniyor (cihazlarimi_temizle), SONRA
// oturumlar kapatılıyordu (signOut scope 'others'). signOut düşerse (ağ,
// 5xx) saldırganın oturumu AÇIK kalıyor ama listeden silinmiş oluyordu:
// liste yenilendiğinde "yalnız bu cihaz" görünür, avukat işin bittiğini
// sanardı. Liste bir görüntüdür; asıl kontrol signOut'tur (0099 göçünün
// kendi notu). Bu yüzden önce asıl kontrol, o başarılıysa görüntü.

function sahte(kapatHatasi: unknown, temizleHatasi = false) {
  const sira: string[] = [];
  return {
    sira,
    adim: {
      oturumlariKapat: async () => {
        sira.push('kapat');
        return { error: kapatHatasi };
      },
      listeyiTemizle: async () => {
        sira.push('temizle');
        if (temizleHatasi) throw new Error('rpc düştü');
        return { error: null };
      },
    },
  };
}

describe('digerOturumlariKapat', () => {
  it('önce oturumlar kapatılır, sonra liste temizlenir', async () => {
    const { sira, adim } = sahte(null);
    await digerOturumlariKapat(adim);
    expect(sira).toEqual(['kapat', 'temizle']);
  });

  it('oturumlar kapatılamazsa liste TEMİZLENMEZ ve hata fırlar', async () => {
    const { sira, adim } = sahte({ message: 'Gateway Timeout' });
    await expect(digerOturumlariKapat(adim)).rejects.toMatchObject({ message: 'Gateway Timeout' });
    expect(sira).toEqual(['kapat']);
  });

  it('oturumlar kapandıysa liste temizliğinin hatası işlemi başarısız saymaz', async () => {
    // Güvenlik adımı tamam; liste yalnız görüntü. Kullanıcıya "kapatılamadı"
    // demek yanlış olurdu.
    const { sira, adim } = sahte(null, true);
    await expect(digerOturumlariKapat(adim)).resolves.toBeUndefined();
    expect(sira).toEqual(['kapat', 'temizle']);
  });
});
