import { describe, it, expect } from 'vitest';
// @ts-ignore
import { excelUret, csvUret, SUTUNLAR, FOTO_EN, FOTO_BOY } from '../arac-audit/js/rapor.js';
// @ts-ignore
import { crc32 } from '../arac-audit/js/zip.js';
// @ts-ignore
import { goruntuBoyutu } from '../arac-audit/js/goruntu.js';
// @ts-ignore
import { sutunAdi, hucreAdi, xmlKacis, gosterimOlcusu } from '../arac-audit/js/xlsx.js';
// @ts-ignore
import { denetimOzeti, sonucBelirle, hataKodu } from '../arac-audit/js/puan.js';

/**
 * ZIP okuyucu — yalnız testte kullanılır. Yazıcımız "store" (sıkıştırmasız)
 * ürettiği için yerel başlıkları tarayarak içeriği çıkarmak yeterli; böylece
 * ürettiğimiz dosyayı kendi kodumuzla DEĞİL, bağımsız bir çözümlemeyle okumuş
 * oluruz.
 */
function zipOku(bayt: Uint8Array): Map<string, Uint8Array> {
  const cozucu = new TextDecoder();
  const g = new DataView(bayt.buffer, bayt.byteOffset, bayt.byteLength);
  const dosyalar = new Map<string, Uint8Array>();
  let i = 0;
  while (i + 30 <= bayt.length && g.getUint32(i, true) === 0x04034b50) {
    const sikistirma = g.getUint16(i + 8, true);
    const boyut = g.getUint32(i + 18, true);
    const adBoyu = g.getUint16(i + 26, true);
    const ekBoy = g.getUint16(i + 28, true);
    const ad = cozucu.decode(bayt.subarray(i + 30, i + 30 + adBoyu));
    const bas = i + 30 + adBoyu + ekBoy;
    if (sikistirma !== 0) throw new Error(`beklenmeyen sıkıştırma: ${ad}`);
    dosyalar.set(ad, bayt.subarray(bas, bas + boyut));
    i = bas + boyut;
  }
  return dosyalar;
}

const metin = (u8?: Uint8Array) => new TextDecoder().decode(u8 ?? new Uint8Array());

/** Gerçek, geçerli bir 3x2 PNG (elle uydurulmuş bayt değil). */
const PNG_3x2 = Uint8Array.from(atob(
  'iVBORw0KGgoAAAANSUhEUgAAAAMAAAACCAIAAADZSiLoAAAAF0lEQVQIHWP8//8/AxJgYkAD1BdgBAB+9wMFbEFOvAAAAABJRU5ErkJggg==',
), (c) => c.charCodeAt(0));

const denetimOrnek = () => ({
  id: 'd1', aracId: 'i20', vin: 'NLHB51ABPDH123456', plaka: '41 ABC 12',
  raporNo: 'QA-1', denetci: 'Test', hat: 'Montaj 2', vardiya: 'A',
  denetimTipi: 'Seri denetim', baslangic: '2026-09-15T08:30:00.000Z', durum: 'devam',
  hatalar: [
    { id: 'h1', parcaId: 'sol_arka_kapi', hataTipiId: 'gicirti', siddet: 'B', adet: 1,
      konum: 'kol dayama hizası', aciklama: 'kapı kapanınca', zaman: '2026-09-15T08:33:00.000Z',
      fotograflar: ['f1'], durum: 'acik' },
    { id: 'h2', parcaId: 'sol_a_garnis', hataTipiId: 'gocuk', siddet: 'A', adet: 2,
      konum: '', aciklama: 'Ampersand & "tırnak" <etiket>', zaman: '2026-09-15T08:36:00.000Z',
      fotograflar: [], durum: 'acik' },
  ],
});

const fotograflar = () => new Map([['f1', { bayt: PNG_3x2, en: 3, boy: 2 }]]);

describe('ZIP yazıcı', () => {
  it('CRC32 bilinen değeri üretir', () => {
    // "123456789" için IEEE CRC32 = 0xCBF43926 (standart sağlama vektörü)
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xCBF43926);
  });
});

describe('görüntü çözümleme', () => {
  it('PNG ölçüsünü başlıktan okur', () => {
    expect(goruntuBoyutu(PNG_3x2)).toEqual({ en: 3, boy: 2, tur: 'png' });
  });

  it('tanınmayan baytta null döner, çökmez', () => {
    expect(goruntuBoyutu(new Uint8Array([1, 2, 3]))).toBeNull();
  });

  it('gösterim ölçüsü en/boy oranını korur', () => {
    const o = gosterimOlcusu(PNG_3x2, 150, 112);
    expect(o.en / o.boy).toBeCloseTo(3 / 2, 1);
    expect(o.en).toBeLessThanOrEqual(150);
    expect(o.boy).toBeLessThanOrEqual(112);
  });
});

describe('Excel hücre adresleri', () => {
  it('sütun harflerini üretir', () => {
    expect(sutunAdi(0)).toBe('A');
    expect(sutunAdi(25)).toBe('Z');
    expect(sutunAdi(26)).toBe('AA');
    expect(sutunAdi(701)).toBe('ZZ');
  });

  it('hücre adresini üretir', () => {
    expect(hucreAdi(0, 0)).toBe('A1');
    expect(hucreAdi(8, 10)).toBe('K9');
  });

  it('XML de yasak denetim karakterlerini atar', () => {
    // Barkod okuyucular ara sıra üretir; dosyaya sızarsa Excel "bozuk" der.
    const s = xmlKacis(`a${String.fromCharCode(3)}b & <c>`);
    expect(s).toBe('ab &amp; &lt;c&gt;');
  });
});

describe('Excel raporu', () => {
  const kitap = excelUret(denetimOrnek(), fotograflar());
  const dosyalar = zipOku(kitap);

  it('Excel in beklediği parçaları içerir', () => {
    for (const yol of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml']) {
      expect([...dosyalar.keys()], `eksik: ${yol}`).toContain(yol);
    }
  });

  it('fotoğrafı dosyanın İÇİNE gömer (bağlantı değil)', () => {
    const medya = [...dosyalar.keys()].filter((a) => a.startsWith('xl/media/'));
    expect(medya).toHaveLength(1);
    // Gömülen bayt, verdiğimiz baytla birebir aynı olmalı
    expect(Array.from(dosyalar.get(medya[0])!)).toEqual(Array.from(PNG_3x2));
  });

  it('fotoğrafı hatanın KENDİ satırında, Fotoğraf sütununda konumlandırır', () => {
    const cizim = metin(dosyalar.get('xl/drawings/drawing1.xml'));
    const fotoSutunu = SUTUNLAR.findIndex((s: any) => s.fotograf);
    expect(cizim).toContain(`<xdr:col>${fotoSutunu}</xdr:col>`);
    // Başlık bloğu + tablo başlığı sonrası ilk hata satırı
    const sayfa = metin(dosyalar.get('xl/worksheets/sheet1.xml'));
    const baslikSatiri = /<row r="(\d+)"[^>]*>(?:(?!<\/row>).)*Hata Kodu/.exec(sayfa);
    expect(baslikSatiri, 'tablo başlığı bulunamadı').not.toBeNull();
    const ilkHataSatiri = Number(baslikSatiri![1]); // 0 tabanlı çizim = 1 tabanlı satır - 1 + 1
    expect(cizim).toContain(`<xdr:row>${ilkHataSatiri}</xdr:row>`);
  });

  it('fotoğrafsız hata için görsel çapası üretmez', () => {
    const cizim = metin(dosyalar.get('xl/drawings/drawing1.xml'));
    expect((cizim.match(/<xdr:oneCellAnchor>/g) ?? [])).toHaveLength(1);
  });

  it('sayfa, SUTUNLAR düzenindeki başlıkları taşır', () => {
    const sayfa = metin(dosyalar.get('xl/worksheets/sheet1.xml'));
    for (const s of SUTUNLAR) {
      if (s.baslik === '#') continue;
      expect(sayfa, `başlık eksik: ${s.baslik}`).toContain(`<t xml:space="preserve">${s.baslik}</t>`);
    }
  });

  it('metinleri XML güvenli kaçırır', () => {
    const sayfa = metin(dosyalar.get('xl/worksheets/sheet1.xml'));
    expect(sayfa).toContain('&amp;');
    expect(sayfa).toContain('&quot;t');
    expect(sayfa).not.toContain('<etiket>');
  });

  it('hata kodu, parça ve hata tipinden kararlı biçimde türer', () => {
    const sayfa = metin(dosyalar.get('xl/worksheets/sheet1.xml'));
    expect(sayfa).toContain('sol_arka_kapi.gicirti');
    expect(hataKodu({ parcaId: 'x', hataTipiId: 'y' })).toBe('x.y');
  });

  it('İngilizce dilde başlıklar değişir', () => {
    const enKitap = excelUret(denetimOrnek(), fotograflar(), { dil: 'en' });
    const sayfa = metin(zipOku(enKitap).get('xl/worksheets/sheet1.xml'));
    expect(sayfa).toContain('VEHICLE AUDIT REPORT');
    expect(sayfa).toContain('Rear door');
  });

  it('hatasız denetimde bile geçerli dosya üretir', () => {
    const bos = { ...denetimOrnek(), hatalar: [] };
    const d = zipOku(excelUret(bos, new Map()));
    expect(d.has('xl/worksheets/sheet1.xml')).toBe(true);
    expect([...d.keys()].some((a) => a.startsWith('xl/media/'))).toBe(false);
  });

  it('fotoğraf ölçüsü sınırları aşmaz', () => {
    const cizim = metin(zipOku(excelUret(denetimOrnek(), fotograflar())).get('xl/drawings/drawing1.xml'));
    const e = /<xdr:ext cx="(\d+)" cy="(\d+)"\/>/.exec(cizim)!;
    expect(Number(e[1]) / 9525).toBeLessThanOrEqual(FOTO_EN);
    expect(Number(e[2]) / 9525).toBeLessThanOrEqual(FOTO_BOY);
  });
});

describe('CSV', () => {
  const csv = csvUret(denetimOrnek());

  it('Excel in Türkçe yerelinde bozulmaması için BOM ve ; kullanır', () => {
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.split('\r\n')[0].split(';').length).toBeGreaterThan(5);
  });

  it('tırnak ve ayraç içeren metni kaçırır', () => {
    expect(csv).toContain('"Ampersand & ""tırnak"" <etiket>"');
  });

  it('fotoğraf sütunu yerine fotoğraf ADEDİ yazar', () => {
    const basliklar = csv.replace('﻿', '').split('\r\n')[0];
    expect(basliklar).not.toContain('Fotoğraf;');
    expect(basliklar).toContain('Fotoğraf adedi');
  });
});

describe('puanlama', () => {
  it('ceza puanı = şiddet ağırlığı × adet', () => {
    const o = denetimOzeti(denetimOrnek());
    // B(5)×1 + A(10)×2 = 25
    expect(o.toplamPuan).toBe(25);
    expect(o.toplamAdet).toBe(3);
    expect(o.toplamHata).toBe(2);
  });

  it('fotoğraflı/fotoğrafsız ayrımını sayar', () => {
    const o = denetimOzeti(denetimOrnek());
    expect(o.fotografliHata).toBe(1);
    expect(o.fotografsizHata).toBe(1);
  });

  it('tek kritik hata aracı reddeder', () => {
    const o = denetimOzeti(denetimOrnek());
    expect(o.sonuc.kod).toBe('RED');
    expect(o.sonuc.gerekce).toContain('kritik');
  });

  it('eşikler ayarlanabilir', () => {
    const sadeceC = { hatalar: [{ parcaId: 'kaput', hataTipiId: 'cizik', siddet: 'C', adet: 3, fotograflar: [] }] };
    expect(denetimOzeti(sadeceC).sonuc.kod).toBe('KABUL');
    expect(denetimOzeti(sadeceC, { kritikVarsaRed: true, sartliPuan: 2, redPuan: 10 }).sonuc.kod).toBe('SARTLI');
    expect(denetimOzeti(sadeceC, { kritikVarsaRed: true, sartliPuan: 1, redPuan: 2 }).sonuc.kod).toBe('RED');
  });

  it('kritik hata varken kritikVarsaRed kapalıysa puana bakar', () => {
    const s = sonucBelirle({ toplamPuan: 10, siddetDagilimi: { A: { adet: 1 } } },
      { kritikVarsaRed: false, sartliPuan: 15, redPuan: 40 });
    expect(s.kod).toBe('KABUL');
  });

  it('bölge ve parça dağılımını puana göre sıralar', () => {
    const o = denetimOzeti(denetimOrnek());
    expect(o.bolgeDagilimi[0].puan).toBeGreaterThanOrEqual(o.bolgeDagilimi[1].puan);
    expect(o.parcaDagilimi[0].id).toBe('sol_a_garnis');
  });

  it('boş denetimde çökmez', () => {
    const o = denetimOzeti({ hatalar: [] });
    expect(o.toplamPuan).toBe(0);
    expect(o.sonuc.kod).toBe('KABUL');
  });
});
