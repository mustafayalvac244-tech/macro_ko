import type { TKey } from '@/i18n';

/**
 * YÖNETİCİ PUSH GÖNDERİMİNİN SONUCU — 10.10.2026, bkz. 0187_push_oturum_ve_sonuc.
 *
 * Panel eskiden gönderim isteği Expo'nun kuyruğuna bırakılır bırakılmaz
 * "Gönderildi: X kişi, Y cihaz" diyordu; o sayı kuyruğa bırakılan cihaz
 * sayısıdır, Expo'nun kabul ettiği ya da Apple/Google'a teslim ettiği değil.
 * Bu dosya sunucunun (admin_bildirim_sonuc) döndürdüğü biletleri ve makbuzları
 * panelde söylenebilecek kadarıyla söyler — fazlasını söylemez: "ok" makbuzu
 * bildirimin Apple/Google'a teslim edildiği demektir, telefonda GÖRÜLDÜĞÜ
 * değil.
 */
export interface BildirimSonucu {
  gonderim_id: number | null;
  hedef_kisi?: number;
  hedef_cihaz?: number;
  bilet?: {
    istek: number;
    yanitsiz: number;
    silinmis: boolean;
    istek_hatasi: number;
    istek_hata_kodlari: Record<string, number>;
    kabul: number;
    ret: number;
    ret_kodlari: Record<string, number>;
  };
  makbuz?: {
    durum: 'yok' | 'erken' | 'istendi' | 'bekliyor' | 'eksik' | 'okundu';
    ok: number;
    hata: number;
    hata_kodlari: Record<string, number>;
    makbuzsuz: number;
  };
}

export interface SonucSatiri {
  anahtar: TKey;
  degerler?: Record<string, string>;
}

/** { A: 2, B: 1 } → "A ×2, B ×1" (sunucu yalnız hata KODU döndürür, metin değil). */
export function kodlariYaz(kodlar: Record<string, number> | null | undefined): string {
  return Object.entries(kodlar ?? {})
    .sort(([, a], [, b]) => b - a)
    .map(([kod, adet]) => `${kod} ×${adet}`)
    .join(', ');
}

export function bildirimSonucSatirlari(s: BildirimSonucu): SonucSatiri[] {
  if (s.gonderim_id == null || !s.bilet || !s.makbuz) return [{ anahtar: 'admin.pushResultNone' }];

  const satirlar: SonucSatiri[] = [];
  const b = s.bilet;
  const cevaplanan = b.istek - b.yanitsiz;

  if (b.istek > 0 && cevaplanan === 0) {
    // Hiç yanıt yok: ya henüz gelmedi ya da pg_net saklama süresi doldu.
    satirlar.push({ anahtar: b.silinmis ? 'admin.pushResultGone' : 'admin.pushResultWaiting' });
    return satirlar;
  }

  satirlar.push({ anahtar: 'admin.pushResultTicket', degerler: { kabul: String(b.kabul), ret: String(b.ret) } });
  if (b.yanitsiz > 0) {
    satirlar.push({ anahtar: 'admin.pushResultPartial', degerler: { n: String(b.yanitsiz) } });
  }
  if (b.istek_hatasi > 0) {
    satirlar.push({ anahtar: 'admin.pushResultReqErr', degerler: { n: String(b.istek_hatasi) } });
  }
  const biletKodlari = kodlariYaz({ ...b.istek_hata_kodlari, ...b.ret_kodlari });
  if (biletKodlari) satirlar.push({ anahtar: 'admin.pushResultCodes', degerler: { kodlar: biletKodlari } });

  const m = s.makbuz;
  if (m.durum === 'okundu') {
    satirlar.push({ anahtar: 'admin.pushResultReceipt', degerler: { ok: String(m.ok), hata: String(m.hata) } });
    const makbuzKodlari = kodlariYaz(m.hata_kodlari);
    if (makbuzKodlari) satirlar.push({ anahtar: 'admin.pushResultCodes', degerler: { kodlar: makbuzKodlari } });
  } else if (m.durum === 'erken') {
    satirlar.push({ anahtar: 'admin.pushResultReceiptEarly' });
  } else if (m.durum === 'istendi' || m.durum === 'bekliyor' || m.durum === 'eksik') {
    satirlar.push({ anahtar: 'admin.pushResultReceiptPending' });
  }
  return satirlar;
}
