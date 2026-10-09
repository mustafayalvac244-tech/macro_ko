import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

/**
 * PLAN SEKMESİ NOTLARI KAYBOLUYORDU (09.10.2026).
 *
 * Duruşma Planı'ndaki sessiz notlar, kontrol listesi işaretleri, değerlendirme
 * ve brief düzeltmeleri yalnız ekran durumundaydı; cihaza ancak "Kaydet"e
 * basınca yazılıyordu. "Ekle"ye basılan not kaydedilmiş görünüyor ama başka
 * sekmeye geçince, ekrandan çıkınca ya da uygulama kapanınca gidiyordu.
 *
 * Artık her değişiklik kısa bir beklemeyle kendiliğinden yazılır; sekme
 * kapanırken ya da uygulama arka plana geçerken bekleyen kayıt hemen yazılır.
 * Bu dosya iki parçayı sınar: bekleme/boşaltma denetleyicisi ve plan yazıcısı
 * (önbellek eşzamanlı güncellenmeli; silinen dava geri yaratılmamalı).
 * Bileşen bağlantısı (WarPlanTab) depoda RN çizici olmadığı için burada
 * sınanmıyor.
 */

const depo = new Map<string, string>();
let yazmaHatasi: Error | null = null;
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => depo.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      if (yazmaHatasi) throw yazmaHatasi;
      depo.set(k, v);
    },
    removeItem: async (k: string) => {
      depo.delete(k);
    },
  },
}));

const { gecikmeliKayit } = await import('@/lib/gecikmeliKayit');
const { planiKaydet, planiSil } = await import('@/hooks/useBriefs');

describe('gecikmeli kayıt denetleyicisi', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('değişiklik bekleme dolunca BİR kez, son hâliyle yazılır', () => {
    const yaz = vi.fn();
    const k = gecikmeliKayit<string>(yaz, 800);
    k.degisti('a');
    k.degisti('ab');
    vi.advanceTimersByTime(799);
    expect(yaz).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(yaz).toHaveBeenCalledTimes(1);
    expect(yaz).toHaveBeenCalledWith('ab');
  });

  it('sekme kapanırken (boşalt) bekleyen kayıt HEMEN yazılır, sonra tekrar yazılmaz', () => {
    const yaz = vi.fn();
    const k = gecikmeliKayit<string>(yaz, 800);
    k.degisti('not eklendi');
    k.bosalt();
    expect(yaz).toHaveBeenCalledWith('not eklendi');
    vi.advanceTimersByTime(5000);
    expect(yaz).toHaveBeenCalledTimes(1);
  });

  it('bekleyen yoksa boşaltmak bir şey yazmaz', () => {
    const yaz = vi.fn();
    gecikmeliKayit<string>(yaz, 800).bosalt();
    expect(yaz).not.toHaveBeenCalled();
  });

  it('vazgeç bekleyeni düşürür (elle Kaydet aynı içeriği zaten yazdı)', () => {
    const yaz = vi.fn();
    const k = gecikmeliKayit<string>(yaz, 800);
    k.degisti('x');
    k.vazgec();
    vi.advanceTimersByTime(5000);
    k.bosalt();
    expect(yaz).not.toHaveBeenCalled();
  });
});

describe('planı yazmak', () => {
  beforeEach(() => {
    depo.clear();
    yazmaHatasi = null;
  });

  it('önbellek AYNI ANDA güncellenir: sekmeye dönünce eski içerik yüklenip son notu ezmesin', async () => {
    const qc = new QueryClient();
    qc.setQueryData(['brief', 'p1'], { content: { notes: [] } });
    const icerik = { notes: [{ at: '12:03', text: 'tanık çelişkisi' }] };
    const bekle = planiKaydet(qc, 'p1', icerik);
    // Yazma bitmeden önbellek yeni içeriği göstermeli.
    expect(qc.getQueryData(['brief', 'p1'])).toEqual({ content: icerik });
    await bekle;
    expect(JSON.parse(depo.get('VEKIL_WARPLAN_p1')!)).toEqual(icerik);
  });

  it('silinen davanın planı sonradan gelen otomatik kayıtla geri yaratılmaz', async () => {
    const qc = new QueryClient();
    await planiSil('p2');
    await planiKaydet(qc, 'p2', { notes: [{ at: '00:01', text: 'geç kalan kayıt' }] });
    expect(depo.has('VEKIL_WARPLAN_p2')).toBe(false);
    expect(qc.getQueryData(['brief', 'p2'])).toBeUndefined();
  });

  it('cihaza yazılamazsa hata yukarı iletilir ve önbellek cihazdakiyle yeniden eşitlenir', async () => {
    const qc = new QueryClient();
    qc.setQueryData(['brief', 'p3'], { content: { notes: [] } });
    yazmaHatasi = new Error('disk dolu');
    await expect(planiKaydet(qc, 'p3', { notes: [{ at: '00:02', text: 'x' }] })).rejects.toThrow('disk dolu');
    expect(qc.getQueryState(['brief', 'p3'])?.isInvalidated).toBe(true);
  });
});
