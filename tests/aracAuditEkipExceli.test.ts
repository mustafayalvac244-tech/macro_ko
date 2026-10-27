import { deflateRawSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { ekipExceliniDoldur, ekipTarihi, tarihAnahtari } from '../arac-audit-app/src/cekirdek/ekipExceli';
import { ciftAnahtari, etiketEslemesi, etiketleriTopla } from '../arac-audit-app/src/cekirdek/ekipEslemesi';
import { Denetim, Hata } from '../arac-audit-app/src/cekirdek/tipler';
import { hucreDegeri, paylasilanMetinler, satirHucreleri, sayfayiBol } from '../arac-audit-app/src/cekirdek/xlsxOku';
import { crc32, HamZipGirdisi, zipHamOku, zipOku, zipOlustur } from '../arac-audit-app/src/cekirdek/zip';

// 27.10.2026 — "excel formati atsam çıktı otomatik doldurur dimi". Ekibin
// gerçek dosyası şirket verisi: depoya girmez. Bu testler UYDURMA, küçük bir
// NAS kitabıyla; yapısı (başlık 2. satırda, metin tarih, BODY sayı, Part /
// Problems listeleri, makro dosyası) gerçeğinden ölçülerek kuruldu. Gerçek
// dosyayla doğrulama yalnız yerelde yapıldı (README, Aşama 8). Beklentileri
// ben yazdım.

const kodla = new TextEncoder();

/** Excel'in yaptığı gibi her girdisi deflate'li bir ZIP. */
function deflateliZip(dosyalar: Record<string, string | Uint8Array>): Uint8Array {
  return zipOlustur(Object.entries(dosyalar).map(([ad, v]): HamZipGirdisi => {
    const veri = typeof v === 'string' ? kodla.encode(v) : v;
    return { ad, adBayt: kodla.encode(ad), yontem: 8, bayrak: 0x0006, crc: crc32(veri), boyut: veri.length, ham: deflateRawSync(veri), zaman: 0, tarih: 0x5521 };
  }));
}

const sst = ['AUDIT CARS LIST', 'NO', 'DATE', 'PROBLEM SOURCE', 'MODEL', 'BODY', 'PROBLEM QTY', 'Auditor', 'UNICODECAR',
  'AUDIT', 'BJ', '1.8.2025', 'DENETCI X', 'AUDITBJ111111', 'AUDITBJ015253',
  'CLASS', 'DEMERIT', 'SYSTEM', 'Problem Part', 'Problem Type', 'EXTRA DETAIL', 'PHOTO LINK', 'RESPONSIBLE', 'AUDITOR', 'PROGRESS',
  'COUNTERMEASURE', 'CM APPLICATION DATE', 'VERIFICATION BODY NO', 'UNICODE', 'Countermeasure Link',
  'MINOR', 'EXTERIOR', ' FRT BUMPER', 'SCRATCH', 'AUDITBJ111111 FRT BUMPERSCRATCH', 'Parça', 'No', 'Problem Type',
  'T GATE INR PNL', 'FRT DR TRIM-LH', ' FRT BUMPER and FDR-LH', 'OVER GAP', 'RATTLE NOISE', '26.10.2026'];
const s = (t: string) => { const i = sst.indexOf(t); if (i < 0) throw new Error(t); return `<c r="#" t="s"><v>${i}</v></c>`; };
const satir = (no: number, hucreler: string[], oz = '') => {
  const harf = (i: number) => String.fromCharCode(65 + i);
  return `<row r="${no}"${oz}>${hucreler.map((h, i) => h.replace('r="#"', `r="${harf(i)}${no}"`)).join('')}</row>`;
};
const n = (v: number, stil = 7) => `<c r="#" s="${stil}"><v>${v}</v></c>`;
const st = (t: string, stil = 7) => s(t).replace('t="s"', `s="${stil}" t="s"`);
const sayfa = (boyut: string, satirlar: string[]) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="${boyut}"/><sheetData>${satirlar.join('')}</sheetData><mergeCells count="1"><mergeCell ref="A1:H1"/></mergeCells></worksheet>`;

const VBA = new Uint8Array(4096).map((_, i) => (i * 37 + 11) & 0xFF);

function ornekKitap(): Uint8Array {
  const aracBaslik = ['NO', 'DATE', 'PROBLEM SOURCE', 'MODEL', 'BODY', 'PROBLEM QTY', 'Auditor', 'UNICODECAR'];
  const problemBaslik = ['NO', 'DATE', 'PROBLEM SOURCE', 'MODEL', 'BODY', 'CLASS', 'DEMERIT', 'SYSTEM', 'Problem Part', 'Problem Type',
    'EXTRA DETAIL', 'PHOTO LINK', 'RESPONSIBLE', 'AUDITOR', 'PROGRESS', 'COUNTERMEASURE', 'CM APPLICATION DATE', 'VERIFICATION BODY NO', 'UNICODE', 'Countermeasure Link'];
  return deflateliZip({
    '[Content_Types].xml': '<?xml version="1.0"?><Types/>',
    'xl/workbook.xml': '<workbook><sheets><sheet name="ANASAYFA" sheetId="1" r:id="rId1"/><sheet name="AUDIT_CARS_LIST" sheetId="2" r:id="rId2"/><sheet name="PROBLEMS_LIST" sheetId="3" r:id="rId3"/><sheet name="Part" sheetId="4" r:id="rId4"/><sheet name="Problems" sheetId="5" r:id="rId5"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Target="/xl/worksheets/sheet3.xml"/><Relationship Id="rId4" Target="worksheets/sheet4.xml"/><Relationship Id="rId5" Target="worksheets/sheet5.xml"/></Relationships>',
    'xl/sharedStrings.xml': `<sst count="${sst.length}">${sst.map((t) => `<si><t xml:space="preserve">${t}</t></si>`).join('')}</sst>`,
    'xl/worksheets/sheet1.xml': sayfa('A1', []),
    'xl/worksheets/sheet2.xml': sayfa('A1:K4', [
      satir(1, [s('AUDIT CARS LIST')], ' ht="51.75"'),
      satir(2, aracBaslik.map((b) => st(b, 57))),
      satir(3, [n(1, 42), st('1.8.2025', 42), st('AUDIT', 42), st('BJ', 42), n(111111, 42), n(0, 42), st('DENETCI X', 42), st('AUDITBJ111111', 42)]),
      satir(4, [n(2), st('1.8.2025'), st('AUDIT'), st('BJ'), n(15253), n(0), st('DENETCI X'), st('AUDITBJ015253'), '<c r="#" s="9"/>'], ' spans="1:9" ht="50.1" customHeight="1" hidden="1"'),
    ]),
    'xl/worksheets/sheet3.xml': sayfa('A1:T3', [
      satir(1, [s('AUDIT CARS LIST')]),
      satir(2, problemBaslik.map((b) => st(b, 26))),
      satir(3, [n(1, 53), st('26.10.2026', 53), st('AUDIT', 53), st('BJ', 53), n(111111, 53), st('MINOR', 53), n(0, 53), st('EXTERIOR', 53),
        st(' FRT BUMPER', 54), st('SCRATCH', 53), '<c r="#" s="53"/>', '<c r="#" s="54"/>', '<c r="#" s="53"/>', st('DENETCI X', 54),
        '<c r="#" s="53"/>', '<c r="#" s="53"/>', '<c r="#" s="53"/>', '<c r="#" s="53"/>', st('AUDITBJ111111 FRT BUMPERSCRATCH', 53), '<c r="#" s="147"/>'], ' ht="50.1" customHeight="1"'),
    ]),
    'xl/worksheets/sheet4.xml': sayfa('A1:B5', [
      satir(1, [s('No'), s('Parça')]),
      satir(2, [n(1), s(' FRT BUMPER')]),
      satir(3, [n(2), s('T GATE INR PNL')]),
      satir(4, [n(3), s('FRT DR TRIM-LH')]),
      satir(5, [n(4), s(' FRT BUMPER and FDR-LH')]),
    ]),
    'xl/worksheets/sheet5.xml': sayfa('A1:B4', [
      satir(1, [s('No'), s('Problem Type')]),
      satir(2, [n(1), s('SCRATCH')]),
      satir(3, [n(2), s('OVER GAP')]),
      satir(4, [n(3), s('RATTLE NOISE')]),
    ]),
    'xl/vbaProject.bin': VBA,
  });
}

const hata = (o: Partial<Hata>): Hata => ({
  id: 'h1', parcaId: 'on_tampon', hataTipiId: 'cizik', derece: '1', kabulEdilebilir: false, sorunTipi: 'Part',
  sorumlu: '', adet: 1, konum: '', aciklama: '', fotograflar: [], zaman: '2026-10-27T09:05:00', durum: 'acik', ...o,
});
const denetim = (o: Partial<Denetim>): Denetim => ({
  id: 'd1', aracId: 'ioniq3', vin: '', bodyNo: '222222', plaka: '', raporNo: '', denetci: 'Denetçi ışık', hat: '', vardiya: '',
  denetimTipi: 'HMC Audit', faz: '', ekip: '', spec: '', km: null,
  baslangic: '2026-10-27T09:00:00', bitis: null, durum: 'tamam', hatalar: [], ...o,
});

/** Çıktıdaki bir sayfanın satırları: satır no → (sütun → değer), ve stil. */
function oku(bayt: Uint8Array, yol: string) {
  const g = new Map(zipOku(bayt).map((x) => [x.ad, new TextDecoder().decode(x.veri)] as const));
  const metinler = paylasilanMetinler(g.get('xl/sharedStrings.xml')!);
  const xml = g.get(yol)!;
  const satirlar = new Map(sayfayiBol(xml).satirlar.map((r) => [r.no, {
    xml: r.xml,
    deger: Object.fromEntries(satirHucreleri(r.xml).map((h) => [h.sutun, hucreDegeri(h, metinler)])),
    stil: Object.fromEntries(satirHucreleri(r.xml).map((h) => [h.sutun, h.stil])),
  }] as const));
  return { xml, satirlar };
}

describe('ekibin Excel\'ini doldur', () => {
  const denetimler = [
    denetim({
      hatalar: [
        hata({ derece: '1', sinif: 'MAJOR', konum: 'sol köşe', fotograflar: ['f_1'] }),
        hata({ id: 'h2', parcaId: 'on_tampon', ikinciParcaId: 'sol_on_camurluk', hataTipiId: 'bosluk_fazla', zaman: '2026-10-27T09:06:00' }),
        hata({ id: 'h3', parcaId: 'anten', hataTipiId: 'tikirti', zaman: '2026-10-27T09:07:00' }),
      ],
    }),
    // Listede zaten olan araç (aynı KAYNAK+MODEL+BODY, baştaki sıfırlı body).
    denetim({ id: 'd2', bodyNo: '015253', baslangic: '2026-10-27T10:00:00', hatalar: [hata({ id: 'h4', parcaId: 'bagaj_ic_panel', zaman: '2026-10-27T10:01:00' })] }),
  ];

  it('satırlar son satırın altına, makronun biçimiyle eklenir', () => {
    const r = ekipExceliniDoldur(ornekKitap(), denetimler);
    expect([r.aracEklendi, r.aracZatenVar, r.problemEklendi, r.problemZatenVar, r.altiHaneOlmayan]).toEqual([1, 1, 4, 0, 0]);

    const a = oku(r.bayt, 'xl/worksheets/sheet2.xml');
    const yeni = a.satirlar.get(5)!;
    // NO = satır − 2; tarih metin g.a.yyyy; BODY sayı; denetçi büyük harf; UNICODECAR metin birleştirme.
    expect(yeni.deger).toEqual({ A: 3, B: '27.10.2026', C: 'AUDIT', D: 'BJ', E: 222222, F: 3, G: 'DENETÇI IŞIK', H: 'AUDITBJ222222', I: null });
    // Stil son satırdan; gizli (filtrelenmiş) satırın "hidden"ı kopyalanmaz; yükseklik kopyalanır.
    expect(yeni.stil).toEqual({ A: '7', B: '7', C: '7', D: '7', E: '7', F: '7', G: '7', H: '7', I: '9' });
    expect(yeni.xml).toContain('ht="50.1" customHeight="1"');
    expect(yeni.xml).not.toContain('hidden');
    expect(a.xml).toContain('<dimension ref="A1:K5"/>');
    expect(a.xml).toContain('<mergeCells count="1">');

    const p = oku(r.bayt, 'xl/worksheets/sheet3.xml');
    expect([...p.satirlar.keys()]).toEqual([1, 2, 3, 4, 5, 6, 7]);
    const p1 = p.satirlar.get(4)!.deger;
    expect(p1).toMatchObject({ A: 2, B: '27.10.2026', C: 'AUDIT', D: 'BJ', E: 222222, F: 'MAJOR', G: 1, I: ' FRT BUMPER', J: 'SCRATCH', K: 'sol köşe', L: 'fotograflar/f_1.jpg', N: 'DENETÇI IŞIK' });
    expect(p1.S).toBe('AUDITBJ222222 FRT BUMPERSCRATCH');
    expect(p.satirlar.get(4)!.stil).toMatchObject({ A: '53', I: '54', T: '147' });
    // İki parça arası: ekibin "A and B" etiketi. Tip listede: birebir.
    expect(p.satirlar.get(5)!.deger).toMatchObject({ I: ' FRT BUMPER and FDR-LH', J: 'OVER GAP' });
    // Ekipte karşılığı olmayan parça: uygulamanın İngilizcesi.
    expect(p.satirlar.get(6)!.deger).toMatchObject({ I: 'Antenna', J: 'RATTLE NOISE' });
    // Listede zaten olan araç: araç satırı eklenmez, problemi eklenir; body'nin baştaki sıfırı UNICODE'da kalır.
    expect(p.satirlar.get(7)!.deger).toMatchObject({ E: 15253, I: 'T GATE INR PNL', S: 'AUDITBJ015253T GATE INR PNLSCRATCH' });

    expect(r.esleme.map((e) => [e.tur, e.anahtar, e.yazilan, e.kaynak, e.adet])).toEqual([
      ['parca', 'on_tampon', ' FRT BUMPER', 'ekip', 1],
      ['tip', 'cizik', 'SCRATCH', 'ekip', 2],
      ['parca', ciftAnahtari('on_tampon', 'sol_on_camurluk'), ' FRT BUMPER and FDR-LH', 'ekip', 1],
      ['tip', 'bosluk_fazla', 'OVER GAP', 'ekip', 1],
      ['parca', 'anten', 'Antenna', 'uygulama', 1],
      ['tip', 'tikirti', 'RATTLE NOISE', 'ekip', 1],
      ['parca', 'bagaj_ic_panel', 'T GATE INR PNL', 'ekip', 1],
    ]);
  });

  it('makro ve dokunulmayan her girdi bayt bayt aynı kalır; sıra korunur', () => {
    const kitap = ornekKitap();
    const r = ekipExceliniDoldur(kitap, denetimler);
    const once = zipHamOku(kitap);
    const sonra = zipHamOku(r.bayt);
    expect(sonra.map((g) => g.ad)).toEqual(once.map((g) => g.ad));
    for (const [i, g] of once.entries()) {
      if (g.ad === 'xl/worksheets/sheet2.xml' || g.ad === 'xl/worksheets/sheet3.xml') continue;
      expect([g.ad, sonra[i]!.yontem, sonra[i]!.crc, Buffer.from(sonra[i]!.ham).equals(Buffer.from(g.ham))]).toEqual([g.ad, 8, g.crc, true]);
    }
    expect([...zipOku(r.bayt).find((g) => g.ad === 'xl/vbaProject.bin')!.veri]).toEqual([...VBA]);
  });

  it('aynı denetimler ikinci kez eklenmez', () => {
    const ilk = ekipExceliniDoldur(ornekKitap(), denetimler);
    const ikinci = ekipExceliniDoldur(ilk.bayt, denetimler);
    expect([ikinci.aracEklendi, ikinci.aracZatenVar, ikinci.problemEklendi, ikinci.problemZatenVar]).toEqual([0, 2, 0, 4]);
    // Yeni bir hata eklenince yalnız o gelir.
    const ek = denetimler.map((d, i) => (i ? d : { ...d, hatalar: [...d.hatalar, hata({ id: 'h5', hataTipiId: 'bosluk_fazla', zaman: '2026-10-27T09:30:00' })] }));
    const ucuncu = ekipExceliniDoldur(ilk.bayt, ek);
    expect([ucuncu.aracEklendi, ucuncu.problemEklendi, ucuncu.problemZatenVar]).toEqual([0, 1, 4]);
  });

  it('kullanıcının düzelttiği eşleme kullanılır; boş seçim uygulamanın adını yazar', () => {
    const r = ekipExceliniDoldur(ornekKitap(), denetimler, { elleEsleme: { parca: { anten: 'ANTENNA ASSY', on_tampon: '' }, tip: { tikirti: 'RATTLE' } } });
    const p = oku(r.bayt, 'xl/worksheets/sheet3.xml');
    expect(p.satirlar.get(4)!.deger.I).toBe('Front bumper');
    expect(p.satirlar.get(6)!.deger).toMatchObject({ I: 'ANTENNA ASSY', J: 'RATTLE' });
    expect(r.esleme.find((e) => e.anahtar === 'anten')!.kaynak).toBe('elle');
    expect(r.esleme.find((e) => e.anahtar === 'on_tampon')!.kaynak).toBe('uygulama');
  });

  it('ekibin dosyası değilse açık hatayla reddedilir', () => {
    const baska = deflateliZip({
      'xl/workbook.xml': '<workbook><sheets><sheet name="Sayfa1" sheetId="1" r:id="rId1"/></sheets></workbook>',
      'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
      'xl/worksheets/sheet1.xml': sayfa('A1', []),
    });
    expect(() => ekipExceliniDoldur(baska, denetimler)).toThrow(/AUDIT_CARS_LIST.*NAS/);
    expect(() => ekipExceliniDoldur(zipOlustur([{ ad: 'veri.json', veri: '{}' }]), denetimler)).toThrow(/Excel/);
  });

  it('tarih biçimleri', () => {
    expect(ekipTarihi('2025-08-01T09:00:00')).toBe('1.8.2025');
    expect(tarihAnahtari('1.8.2025')).toBe('2025-08-01');
    expect(tarihAnahtari('01.08.2025')).toBe('2025-08-01');
    expect(tarihAnahtari(45870)).toBe('2025-08-01');
  });
});

describe('etiket eşlemesi (uydurma etiketler)', () => {
  type O = { id: string; metin: string; taraf?: 'sol' | 'sag' };
  const ogeler: O[] = [
    { id: 'sol_kapi', metin: 'sol on kapi lh front door sol lh left', taraf: 'sol' },
    { id: 'sag_kapi', metin: 'sag on kapi rh front door sag rh right', taraf: 'sag' },
    { id: 'tampon', metin: 'on tampon front bumper' },
  ];
  const esle = (etiketler: string[], kayitlar: string[] = []) => etiketEslemesi(etiketleriTopla(etiketler, kayitlar), ogeler, {
    kimlik: (x) => x.id, metin: (x) => x.metin, adMetni: (x) => x.metin, taraf: (x) => x.taraf,
    ayna: (id) => (id.startsWith('sol_') ? `sag_${id.slice(4)}` : id.startsWith('sag_') ? `sol_${id.slice(4)}` : undefined), ciftler: true,
  });

  it('taraf söyleyen etiket o taraftaki parçaya; tarafsız etiket iki tarafa birden', () => {
    const m = esle(['FRT DR-LH', 'FRT DR']);
    expect(m.get('sol_kapi')!.ad).toBe('FRT DR-LH');
    expect(m.get('sag_kapi')!.ad).toBe('FRT DR');
  });

  it('tarafsız parçaya taraf söylemeyen etiket; sonra listede olan; sonra sık kullanılan', () => {
    expect(esle(['FRT BUMPER-LH', 'FRT BUMPER']).get('tampon')!.ad).toBe('FRT BUMPER');
    expect(esle(['FRT BUMPER'], ['BUMPER FRT', 'BUMPER FRT', 'BUMPER FRT']).get('tampon')!.ad).toBe('FRT BUMPER');
    expect(esle(['FRT BUMPER', 'BUMPER'], ['BUMPER', 'BUMPER']).get('tampon')!.ad).toBe('BUMPER');
  });

  it('"A AND B" iki parçanın arası; tarafı her iki yarıya geçer', () => {
    const m = esle(['FRT BUMPER AND FRT DR-LH']);
    expect(m.get(ciftAnahtari('tampon', 'sol_kapi'))!.ad).toBe('FRT BUMPER AND FRT DR-LH');
    expect(m.has(ciftAnahtari('tampon', 'sag_kapi'))).toBe(false);
  });

  it('kelimelerinin yarısı parçada geçmeyen etiket aday olmaz', () => {
    expect(esle(['FRT BUMPER LOWER GRAY GARNISH']).has('tampon')).toBe(false);
  });
});
