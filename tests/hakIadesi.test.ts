import { describe, expect, it, vi } from 'vitest';
import { basarisizsaIadeEt, rezervasyonuIadeEt, yeniRezervasyon } from '../supabase/functions/_shared/hakIadesi';

// 08.10.2026: servis hatası / boş cevap / çökme durumunda ayrılan hak geri
// verilmiyordu (ai-chat'in altı modunda da). Bu testler sarmalayıcıyı korur.
const islemler = () => ({ deneme: vi.fn(async () => {}), mod: vi.fn(async () => {}) });
const yanit = (durum: number) => new Response('{}', { status: durum });

describe('başarısız istekte hak iadesi', () => {
  it('başarılı (200) istekte hak GERİ VERİLMEZ', async () => {
    const r = yeniRezervasyon();
    const i = islemler();
    await basarisizsaIadeEt(r, async () => { r.userId = 'u1'; r.deneme = true; return yanit(200); }, i);
    expect(i.deneme).not.toHaveBeenCalled();
    expect(i.mod).not.toHaveBeenCalled();
  });

  it('servis hatasında (502) deneme hakkı geri verilir', async () => {
    const r = yeniRezervasyon();
    const i = islemler();
    const y = await basarisizsaIadeEt(r, async () => { r.userId = 'u1'; r.deneme = true; return yanit(502); }, i);
    expect(y.status).toBe(502);
    expect(i.deneme).toHaveBeenCalledTimes(1);
    expect(i.deneme).toHaveBeenCalledWith('u1');
  });

  it('sağlayıcı sınırında (429) AI paketi kotası doğru ay ve türle geri verilir', async () => {
    const r = yeniRezervasyon();
    const i = islemler();
    await basarisizsaIadeEt(r, async () => { r.userId = 'u2'; r.mod = { ay: '2026-10', mutalaa: true }; return yanit(429); }, i);
    expect(i.mod).toHaveBeenCalledWith('u2', '2026-10', true);
    expect(i.deneme).not.toHaveBeenCalled();
  });

  it('istek çökerse hak geri verilir ve hata yine fırlatılır', async () => {
    const r = yeniRezervasyon();
    const i = islemler();
    await expect(basarisizsaIadeEt(r, async () => { r.userId = 'u3'; r.deneme = true; throw new Error('çöktü'); }, i)).rejects.toThrow('çöktü');
    expect(i.deneme).toHaveBeenCalledTimes(1);
  });

  it('hak ayrılmadan reddedilen istekte (402 hak bitti) iade YOK', async () => {
    const r = yeniRezervasyon();
    const i = islemler();
    await basarisizsaIadeEt(r, async () => yanit(402), i);
    expect(i.deneme).not.toHaveBeenCalled();
    expect(i.mod).not.toHaveBeenCalled();
  });

  it('iki kez çağrılsa da hak bir kez iade edilir', async () => {
    const r = { userId: 'u4', deneme: true, mod: { ay: '2026-10', mutalaa: false } };
    const i = islemler();
    await rezervasyonuIadeEt(r, i);
    await rezervasyonuIadeEt(r, i);
    expect(i.deneme).toHaveBeenCalledTimes(1);
    expect(i.mod).toHaveBeenCalledTimes(1);
  });
});
