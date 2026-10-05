import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fihristCoz, fihristUrl, turkiyeBugun } from '../supabase/functions/_shared/resmiGazete';
import { grupla, grupOnceligi, onemliMaddeler, universiteMi } from '@/lib/resmiGazete';

// Gerçek fihristler (resmigazete.gov.tr, windows-1254, 05.10.2026'da indirildi).
const oku = (ad: string) =>
  new TextDecoder('windows-1254').decode(readFileSync(new URL(`./fixtures/resmi-gazete/${ad}`, import.meta.url)));
const tireSayisi = (html: string) => (html.replace(/<[^>]+>/g, ' ').match(/––/g) ?? []).length;

describe('fihristCoz — gerçek fihristler', () => {
  it('01.10.2026: 18 madde, sayı 33387, ilk madde CB kararı', () => {
    const html = oku('20261001.htm');
    const f = fihristCoz(html, fihristUrl('2026-10-01'));
    expect(f.sayi).toBe(33387);
    expect(f.maddeler).toHaveLength(18);
    expect(f.maddeler).toHaveLength(tireSayisi(html));
    expect(f.maddeler[0]).toMatchObject({ bolum: 'YÜRÜTME VE İDARE BÖLÜMÜ', grup: 'CUMHURBAŞKANI KARARLARI' });
    expect(f.maddeler[1].baslik).toBe('Bazı Mallara Uygulanan Özel Tüketim Vergisi Tutarlarının Yeniden Belirlenmesi Hakkında Karar (Karar Sayısı: 11822)');
    expect(f.maddeler[1].url).toBe('https://www.resmigazete.gov.tr/eskiler/2026/10/20261001-3-3.pdf');
    expect(f.mukerrerler).toEqual([]);
  });

  it('başlıkta tire, &nbsp; ve &#8200; kalmaz', () => {
    const f = fihristCoz(oku('20261001.htm'), fihristUrl('2026-10-01'));
    for (const m of f.maddeler) {
      expect(m.baslik).not.toMatch(/^[–\-\s]/);
      expect(m.baslik).not.toMatch(/&nbsp;|&#\d+;|\s{2}/);
    }
  });

  it('18.09.2026: Anayasa Mahkemesi kararları YARGI BÖLÜMÜ altında', () => {
    const html = oku('20260918.htm');
    const f = fihristCoz(html, fihristUrl('2026-09-18'));
    expect(f.maddeler).toHaveLength(tireSayisi(html));
    const aym = f.maddeler.filter((m) => m.grup === 'ANAYASA MAHKEMESİ KARARLARI');
    expect(aym.length).toBeGreaterThan(0);
    for (const m of aym) expect(m.bolum).toBe('YARGI BÖLÜMÜ');
  });

  it('06.09.2026: mükerrer sayfa bağlantısı bulunur ve madde sayılmaz', () => {
    const f = fihristCoz(oku('20260906.htm'), fihristUrl('2026-09-06'));
    expect(f.mukerrerler).toEqual(['https://www.resmigazete.gov.tr/eskiler/2026/09/20260906M1.htm']);
    // Maddeler PDF de HTML de olabilir (06.09'da üçü de .htm); mükerrer
    // sayfanın kendisi madde listesine KARIŞMAMALI.
    expect(f.maddeler).toHaveLength(3);
    expect(f.maddeler.some((m) => /M\d+\.htm$/.test(m.url))).toBe(false);
  });

  it('mükerrer sayfa: Orta Vadeli Program, mukerrer işaretli', () => {
    const f = fihristCoz(oku('20260906M1.htm'), 'https://www.resmigazete.gov.tr/eskiler/2026/09/20260906M1.htm', true);
    expect(f.maddeler).toHaveLength(1);
    expect(f.maddeler[0]).toMatchObject({ grup: 'CUMHURBAŞKANI KARARI', mukerrer: true });
    expect(f.maddeler[0].baslik).toMatch(/^Orta Vadeli Program \(2027-2029\)/);
  });

  it('ilan bölümü alınmaz', () => {
    for (const ad of ['20261001.htm', '20260918.htm', '20260906.htm']) {
      const f = fihristCoz(oku(ad), fihristUrl('2026-10-01'));
      expect(f.maddeler.some((m) => /İL[AÂ]N/.test(m.bolum))).toBe(false);
    }
  });
});

describe('yardımcılar', () => {
  it('fihrist adresi', () => {
    expect(fihristUrl('2026-10-05')).toBe('https://www.resmigazete.gov.tr/eskiler/2026/10/20261005.htm');
  });

  it('Türkiye günü UTC+3: 21:00 UTC ertesi gündür', () => {
    expect(turkiyeBugun(new Date('2026-10-04T20:59:00Z'))).toBe('2026-10-04');
    expect(turkiyeBugun(new Date('2026-10-04T21:00:00Z'))).toBe('2026-10-05');
  });

  it('öncelik: kanun > AYM > CB kararı > yönetmelik > atama', () => {
    const s = ['ATAMA KARARLARI', 'YÖNETMELİKLER', 'CUMHURBAŞKANI KARARLARI', 'ANAYASA MAHKEMESİ KARARI', 'KANUNLAR'].map(grupOnceligi);
    expect([...s].sort((a, b) => b - a)).toEqual(s);
  });

  it('üniversite yönetmeliği ayırt edilir', () => {
    expect(universiteMi({ bolum: '', grup: 'YÖNETMELİKLER', baslik: 'Koç Üniversitesi Lisansüstü Eğitim Yönetmeliği', url: '' })).toBe(true);
    expect(universiteMi({ bolum: '', grup: 'YÖNETMELİKLER', baslik: 'Avukatlık Kanunu Yönetmeliğinde Değişiklik', url: '' })).toBe(false);
  });

  it('01.10.2026 öne çıkanlar: ataması yok, ilki CB kararı; gruplar önceliğe göre', () => {
    const f = fihristCoz(oku('20261001.htm'), fihristUrl('2026-10-01'));
    const o = onemliMaddeler(f.maddeler);
    expect(o.some((m) => /ATAMA/.test(m.grup))).toBe(false);
    expect(o[0].grup).toBe('CUMHURBAŞKANI KARARLARI');
    const g = grupla(f.maddeler).map((x) => x.grup);
    expect(g[0]).toBe('CUMHURBAŞKANI KARARLARI');
    expect(g[g.length - 1]).toBe('ATAMA KARARLARI');
    expect(grupla(f.maddeler).reduce((n, x) => n + x.maddeler.length, 0)).toBe(f.maddeler.length);
  });
});
