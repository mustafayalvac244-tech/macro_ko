// Yönetici push sonucunun panelde söylenmesi — 10.10.2026, bkz. 0187.
// Korunan: kuyruk sayısı “ulaştı” diye sunulmaz; “ok” makbuz yalnız
// Apple/Google’a teslim sayılır; yanıt gelmeyen ya da silinen yanıt “başarılı”
// gibi okunmaz.
import { describe, expect, it } from 'vitest';
import { bildirimSonucSatirlari, kodlariYaz, type BildirimSonucu } from '../src/utils/bildirimSonucu';

const bos = { istek_hata_kodlari: {}, ret_kodlari: {} };
function sonuc(p: Partial<NonNullable<BildirimSonucu['bilet']>>, m: Partial<NonNullable<BildirimSonucu['makbuz']>> = {}): BildirimSonucu {
  return {
    gonderim_id: 1,
    bilet: { istek: 1, yanitsiz: 0, silinmis: false, istek_hatasi: 0, kabul: 0, ret: 0, ...bos, ...p },
    makbuz: { durum: 'yok', ok: 0, hata: 0, hata_kodlari: {}, makbuzsuz: 0, ...m },
  };
}
const anahtarlar = (s: BildirimSonucu) => bildirimSonucSatirlari(s).map((x) => x.anahtar);

describe('bildirimSonucSatirlari', () => {
  it('gönderim yoksa tek satır', () => {
    expect(anahtarlar({ gonderim_id: null })).toEqual(['admin.pushResultNone']);
  });

  it('hiç yanıt gelmediyse kabul/ret sayısı (0/0) gösterilmez', () => {
    expect(anahtarlar(sonuc({ yanitsiz: 1 }))).toEqual(['admin.pushResultWaiting']);
  });

  it('yanıt saklama süresi geçip silindiyse “bilinmiyor” denir, başarı denmez', () => {
    expect(anahtarlar(sonuc({ yanitsiz: 1, silinmis: true }))).toEqual(['admin.pushResultGone']);
  });

  it('kabul ve ret sayıları ile hata kodları yazılır', () => {
    const s = bildirimSonucSatirlari(sonuc({ kabul: 2, ret: 1, ret_kodlari: { DeviceNotRegistered: 1 } }, { durum: 'erken' }));
    expect(s[0]).toEqual({ anahtar: 'admin.pushResultTicket', degerler: { kabul: '2', ret: '1' } });
    expect(s[1]).toEqual({ anahtar: 'admin.pushResultCodes', degerler: { kodlar: 'DeviceNotRegistered ×1' } });
    expect(s[2].anahtar).toBe('admin.pushResultReceiptEarly');
  });

  it('bir kısım istek yanıtsızsa ve bir kısmı Expo’ya ulaşmadıysa ikisi ayrı söylenir', () => {
    const k = anahtarlar(sonuc({ istek: 3, yanitsiz: 1, istek_hatasi: 1, kabul: 5, istek_hata_kodlari: { http_503: 1 } }));
    expect(k).toContain('admin.pushResultPartial');
    expect(k).toContain('admin.pushResultReqErr');
  });

  it('makbuz okunduysa teslim ve hata sayısı; bekleyenler “tekrar okuyun”', () => {
    const okundu = bildirimSonucSatirlari(sonuc({ kabul: 2 }, { durum: 'okundu', ok: 1, hata: 1, hata_kodlari: { MessageRateExceeded: 1 } }));
    expect(okundu.map((x) => x.anahtar)).toContain('admin.pushResultReceipt');
    for (const durum of ['istendi', 'bekliyor', 'eksik'] as const) {
      expect(anahtarlar(sonuc({ kabul: 2 }, { durum }))).toContain('admin.pushResultReceiptPending');
    }
    // makbuz yoksa (hiç kabul edilmedi) makbuz satırı eklenmez
    expect(anahtarlar(sonuc({ kabul: 0, ret: 2 }))).toEqual(['admin.pushResultTicket']);
  });
});

describe('kodlariYaz', () => {
  it('çoktan aza sıralar', () => {
    expect(kodlariYaz({ A: 1, B: 3 })).toBe('B ×3, A ×1');
    expect(kodlariYaz(undefined)).toBe('');
  });
});
