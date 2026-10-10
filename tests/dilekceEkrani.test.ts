import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BOS_UYARI,
  disaAktarOnayMetni,
  dosyaSecenekleri,
  duzeltmeUyarilari,
  gecerliDosyaId,
  teyitsizOgeSayilari,
  uretimUyarilari,
} from '@/utils/dilekceEkrani';

/**
 * DİLEKÇE EKRANI — 09.10.2026 denetimi, ajan 20.
 * Ekran bileşeni test edilemez (RN çalışma zamanı yok); mantık saf yardımcıya
 * çıkarıldı, ekran bağlantıları kaynak okuyarak sabitlendi (depodaki kalıp).
 */

const KOK = join(__dirname, '..');
const oku = (p: string) => readFileSync(join(KOK, p), 'utf8');

const dava = (n: number) => ({ id: `d${n}`, title: `Dosya ${n}` });
const davalar = (adet: number) => Array.from({ length: adet }, (_, i) => dava(i + 1));

describe('dosya seçici — 12 dosya sınırı', () => {
  it('12 ve altında hepsi görünür, gizli yok', () => {
    const s = dosyaSecenekleri(davalar(12), null, false);
    expect(s.liste).toHaveLength(12);
    expect(s.gizli).toBe(0);
  });

  it('13. ve sonraki dosyalar ERİŞİLEMEZ OLMAMALI: gizli sayı verilir, "tümü" hepsini açar', () => {
    const kapali = dosyaSecenekleri(davalar(15), null, false);
    expect(kapali.liste).toHaveLength(12);
    expect(kapali.gizli).toBe(3);
    const acik = dosyaSecenekleri(davalar(15), null, true);
    expect(acik.liste).toHaveLength(15);
    expect(acik.gizli).toBe(0);
  });

  it('seçili dosya ilk 12 dışındaysa kapalıyken de listede kalır (görünmez seçim olmaz)', () => {
    const s = dosyaSecenekleri(davalar(15), 'd14', false);
    expect(s.liste.map((d) => d.id)).toContain('d14');
    expect(s.liste).toHaveLength(13); // ilk 12 + seçili
    expect(s.gizli).toBe(2);
  });

  it('listede olmayan (kapanmış/silinmiş) dosya kimliği temizlenir; liste yüklenirken dokunulmaz', () => {
    expect(gecerliDosyaId(undefined, 'd1')).toBe('d1');
    expect(gecerliDosyaId(davalar(3), 'd2')).toBe('d2');
    expect(gecerliDosyaId(davalar(3), 'd99')).toBeNull();
    expect(gecerliDosyaId(davalar(3), null)).toBeNull();
  });
});

describe('Düzelt sonrası bayat uyarılar', () => {
  const ilk = uretimUyarilari({
    eksikBolum: ['Talep sonucu'],
    talepEksik: ['Kararın kaldırılması istenmemiş'],
    cakisanDayanak: ['Temerrüt ve iki haklı ihtar birlikte'],
    uydurmaMadde: ['TBK 999'],
    uydurmaTutar: [1500],
    ayiklananTarih: 2,
    hakDusulmedi: true,
    yedekModel: true,
    istekId: 'istek-1',
    kullanim: { model: 'm1', girdiToken: 1, ciktiToken: 2, maliyetTL: 0.5 },
    ekUyari: { taranmis: true },
  });

  it('üretim yanıtı tüm uyarıları ve istek kimliğini taşır', () => {
    expect(ilk.eksikBolum).toEqual(['Talep sonucu']);
    expect(ilk.istekId).toBe('istek-1');
    expect(ilk.yapiDenetimiEski).toBe(false);
  });

  it('düzeltme yanıtı metin denetimlerini YENİLER (sunucu yeniden denetliyor)', () => {
    const son = duzeltmeUyarilari(ilk, { uydurmaMadde: undefined, uydurmaTutar: undefined, ayiklananTarih: 0, istekId: 'istek-2' });
    expect(son.uydurmaMadde).toEqual([]);
    expect(son.uydurmaTutar).toEqual([]);
    expect(son.ayiklanan).toBe(0);
    expect(son.istekId).toBe('istek-2');
    // istek-1'in "yedek model / hak düşülmedi" bilgisi istek-2 için geçerli DEĞİL:
    expect(son.yedekModel).toBe(false);
    expect(son.hakDusulmedi).toBe(false);
    expect(son.kullanim).toBeNull();
  });

  it('düzeltme sunucuda eksik bölüm/talep/çakışma için YENİDEN denetlenmez: bayat olduğu İŞARETLENİR, sessizce silinmez', () => {
    const son = duzeltmeUyarilari(ilk, { istekId: 'istek-2' });
    expect(son.yapiDenetimiEski).toBe(true);
    // Hâlâ gerçek olabilirler; gizlemek avukatı yanıltırdı.
    expect(son.eksikBolum).toEqual(['Talep sonucu']);
    expect(son.talepEksik).toEqual(['Kararın kaldırılması istenmemiş']);
    // Eklerle ilgili uyarı girdiyle ilgili, düzeltmeyle değişmez.
    expect(son.ekUyari).toEqual({ taranmis: true });
  });

  it('boş başlangıç durumu hiçbir uyarı taşımaz', () => {
    expect(BOS_UYARI.eksikBolum).toEqual([]);
    expect(BOS_UYARI.istekId).toBeNull();
  });
});

describe('dışa aktarmadan önce teyitsiz atıf onayı', () => {
  const t = (k: string, p?: Record<string, string | number>) => `${k}|${JSON.stringify(p ?? {})}`;

  it('temiz taslakta onay YOK', () => {
    expect(disaAktarOnayMetni(BOS_UYARI, t)).toBeNull();
    const dogrulanmis = uretimUyarilari({
      kararDenetimi: { toplam: 2, dogrulanan: [{ atif: 'Y.9.HD 2020/1' }], havuzdaYok: [], olanaksiz: [] },
    });
    expect(disaAktarOnayMetni(dogrulanmis, t)).toBeNull();
  });

  it('madde, tutar ve künye sayıları ayrı sayılır; çıkarılan künyeler de sayılır (yerinde boşluk kalır)', () => {
    const u = uretimUyarilari({
      uydurmaMadde: ['TBK 999', 'HMK 1'],
      uydurmaTutar: [1500],
      kararDenetimi: {
        toplam: 5,
        dogrulanan: [],
        havuzdaYok: ['a'],
        canlidaYok: ['b', 'c'],
        olanaksiz: [{ atif: 'd', sebep: 'x' }],
      },
    });
    expect(teyitsizOgeSayilari(u)).toEqual({ madde: 2, tutar: 1, kunye: 4 });
    const metin = disaAktarOnayMetni(u, t);
    expect(metin).toContain('cikti.onayMetni');
    expect(metin).toContain('cikti.onayMadde');
    expect(metin).toContain('cikti.onayTutar');
    expect(metin).toContain('cikti.onayKunye');
  });

  it('yalnız madde varsa yalnız madde anılır', () => {
    const metin = disaAktarOnayMetni(uretimUyarilari({ uydurmaMadde: ['TBK 999'] }), t)!;
    expect(metin).toContain('cikti.onayMadde');
    expect(metin).not.toContain('cikti.onayTutar');
    expect(metin).not.toContain('cikti.onayKunye');
  });
});

describe('ekran bağlantıları (kaynak sözleşmesi)', () => {
  const ekran = oku('app/dilekce-uret.tsx');

  it('Üret, Düzelt sürerken çalışmaz; Düzelt, Üret sürerken çalışmaz (yarış)', () => {
    expect(ekran).toMatch(/if \(question\.length < 20 \|\| mesgul\) return;/);
    expect(ekran).toMatch(/if \(tal\.length < 3 \|\| mesgul\) return;/);
    expect(ekran).toMatch(/disabled=\{tooShort \|\| mesgul\}/);
    expect(ekran).toMatch(/disabled=\{mesgul \|\| talimat\.trim\(\)\.length < 3\}/);
  });

  it('ölçüme model ve istek kimliği geçer', () => {
    expect(ekran).toMatch(/model=\{uy\.kullanim\?\.model\}/);
    expect(ekran).toMatch(/istekId=\{uy\.istekId\}/);
  });

  it('temizle/ geri al bekleyen yanıtı geçersiz kılar: gelen yanıt eski taslağı diriltmez', () => {
    expect(ekran).toMatch(/istekNo\.current \+= 1/);
    expect(ekran).toMatch(/no !== istekNo\.current/);
  });

  it('ölçüm efekti model/istekId\'ye bağlı DEĞİL: yeni taslakta eski→yeni metni "düzeltme" diye kaydetmez', () => {
    const bilesen = oku('src/components/ui/DuzenlenebilirCikti.tsx');
    expect(bilesen).toMatch(/\}, \[acik, mod, duzenlenen\]\);/);
  });

  it('başarısız dışa aktarma "bitti" ölçümünü tetiklemez', () => {
    expect(oku('src/components/ui/CiktiEylemleri.tsx')).toMatch(/if \(ciktiBasarili\(s\)\) onDisaAktar\?\.\(\);/);
  });

  it('hak iadesi: sunucunun mode:iade ucu bağlı', () => {
    expect(ekran).toMatch(/mode: 'iade'/);
  });

  it.each([
    'app/contract.tsx',
    'app/templates.tsx',
    'src/components/case/WarPlanTab.tsx',
    'app/(app)/cases/[id].tsx',
  ])('%s: metniPaylas sonucu yutulmaz', (dosya) => {
    const kaynak = oku(dosya);
    // Çıplak "metniPaylas(...)" deyimi (sonucu kullanılmayan) kalmamalı.
    expect(kaynak).not.toMatch(/^\s*metniPaylas\(/m);
    expect(kaynak).toMatch(/ciktiSonucunuBildir\(/);
  });
});
