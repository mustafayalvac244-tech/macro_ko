import { afterEach, describe, expect, it } from 'vitest';
import { sayfaIskeleti } from '../extension/lib/kesif.js';

// Küçük sahte DOM: yalnız sayfaIskeleti'nin dokunduğu alanlar.
type Sahte = {
  nodeType: number;
  tagName?: string;
  textContent?: string;
  id?: string;
  childNodes?: Sahte[];
  getAttribute?: (a: string) => string | null;
};
const m = (s: string): Sahte => ({ nodeType: 3, textContent: s });
const el = (tag: string, attrs: Record<string, string> = {}, ...kids: (Sahte | string)[]): Sahte => ({
  nodeType: 1,
  tagName: tag.toUpperCase(),
  id: attrs.id ?? '',
  childNodes: kids.map((k) => (typeof k === 'string' ? m(k) : k)),
  getAttribute: (a) => attrs[a] ?? null,
});

const g = globalThis as Record<string, unknown>;
const kur = (body: Sahte, ara = '?dosyaId=987654&tur=hukuk') => {
  g.location = { host: 'avukat.uyap.gov.tr', pathname: '/dosya/123456/detay', search: ara };
  g.document = { title: 'UYAP Avukat Portal', body };
  g.window = { top: 'ust' };
};
afterEach(() => {
  delete g.location;
  delete g.document;
  delete g.window;
});

// Gerçeğe benzer, uydurma bir dosya listesi. Aşağıdaki DEĞERLERİN hiçbiri
// çıktıda geçmemeli.
const SIZMAMALI = ['AHMET YILMAZ', 'Ayşe Demir', '2023/145', '2024/9876', '12345678901', '15.03.2026', '10:30', '987654', '123456', 'gizli-arama', '45.250,00'];
const sayfa = () =>
  el('body', {},
    el('h1', {}, 'Dosya Sorgulama'),
    el('input', { type: 'text', name: 'esasNo', placeholder: 'Esas No' }),
    el('input', { type: 'text', name: 'ara', value: 'gizli-arama' }),
    el('table', { class: 'tablo liste' },
      el('thead', {}, el('tr', {}, el('th', {}, 'Esas No'), el('th', {}, 'Birim'), el('th', {}, 'Davacı'), el('th', {}, 'Durum'))),
      el('tbody', {},
        ...[1, 2, 3, 4, 5].map((i) =>
          el('tr', { class: 'satir' },
            el('td', {}, i % 2 ? '2023/145' : '2024/9876'),
            el('td', {}, 'ANKARA 3. ASLİYE HUKUK MAHKEMESİ'),
            el('td', {}, i % 2 ? 'AHMET YILMAZ' : 'Ayşe Demir'),
            el('td', {}, 'Açık'),
          ),
        ),
      ),
    ),
    el('div', {}, 'Esas No: 2023/145'),
    el('div', {}, 'Davacı: AHMET YILMAZ'),
    el('span', {}, 'TC: 12345678901'),
    el('span', {}, '15.03.2026 10:30'),
    el('span', {}, '45.250,00 TL'),
    el('div', { 'aria-label': 'AHMET YILMAZ dosyası' }, 'x'),
    el('iframe', { src: '/icerik/987654?a=1' }),
    el('script', {}, 'var gizli = "AHMET YILMAZ"'),
  );

describe('UYAP keşif — değer sızmaz, yapı kalır', () => {
  it('hiçbir müvekkil değeri çıktıda yok', () => {
    kur(sayfa());
    const cikti = JSON.stringify(sayfaIskeleti());
    for (const s of SIZMAMALI) expect(cikti, s).not.toContain(s);
  });

  it('etiketler, sütun başlıkları ve kalıplar kalır; tekrar eden satırlar sayılır', () => {
    kur(sayfa());
    const r = sayfaIskeleti();
    const c = JSON.stringify(r);
    for (const s of ['Dosya Sorgulama', 'Esas No', 'Birim', 'Davacı', 'Durum', '‹ESAS_NO›', '‹BUYUK_METIN:12›', '‹11_HANE›', '‹TARIH_SAAT›', '‹TUTAR›', 'Esas No: ‹ESAS_NO›', 'Davacı: ‹BUYUK_METIN:12›'])
      expect(c, s).toContain(s);
    expect(c).toContain('"tekrar":"tr.satir","adet":5');
    expect(r.adres).toBe('avukat.uyap.gov.tr/dosya/‹n›/detay');
    expect(r.sorguAdlari).toEqual(['dosyaId', 'tur']);
    expect(c).toContain('"alan":{"tur":"text","ad":"esasNo","ipucu":"Esas No"}');
    expect(c).toContain('"cerceve":"/icerik/‹n›"');
    expect(c).not.toContain('var gizli');
  });

  it('td içindeki tek sözcük etiket sayılmaz (ad olabilir)', () => {
    kur(el('body', {}, el('td', {}, 'Durum'), el('th', {}, 'Durum')));
    const c = JSON.stringify(sayfaIskeleti());
    expect(c).toContain('"x":"‹METIN:5›"');
    expect(c).toContain('"x":"Durum"');
  });
});

// 08.10.2026: denetçi şu girdilerin HAM çıktığını ölçtü — sözlük sözcüğü +
// rakam, etiket sayılıyordu. Ayrıca yol/çerçeve/alan adlarında oturum kimliği.
describe('UYAP keşif — rakamlı etiketler ve kimlikler', () => {
  it('etiket rolündeki rakamlı metin, başlık ve oturum kimliği sızmaz', () => {
    const govde = el('body', {},
      el('a', {}, 'Dosya 2023/145'),
      el('li', {}, '2023/145 Esas'),
      el('a', {}, 'Duruşma 15.03.2026 10:30'),
      el('div', { title: 'TC Kimlik No 12345678901' }, 'x'),
      el('iframe', { src: '/x/y.jsp;jsessionid=ABCDEF12' }),
      el('input', { type: 'text', name: 'sec_98765_ab' }),
      el('button', {}, 'Sorgula'),
    );
    kur(govde);
    g.document = { title: 'Dosya Detayı - 2023/145 E.', body: govde };
    const json = JSON.stringify(sayfaIskeleti());
    for (const s of ['2023/145', '15.03.2026', '10:30', '12345678901', 'ABCDEF12', 'jsessionid', '98765']) {
      expect(json).not.toContain(s);
    }
    // Rakamsız arayüz etiketi yine aynen kalır.
    expect(json).toContain('"Sorgula"');
  });
});

// 10.10.2026 (29. alan denetçisi): 08.10 düzeltmesi yol/ad/rakam kalıbını
// kapadı ama adresin DİĞER parçaları ham kalıyordu — çerçeve adresindeki
// `#parça`, `kullanıcı:parola@`, yabancı alan adı, `javascript:` gövdesi,
// `=` taşıyan yol parçası ve değersiz sorgu belirteci (`?OTURUMKODU`).
describe('UYAP keşif — adresin diğer parçaları', () => {
  const GIZLI = ['GIZLIOTURUM', 'GIZLIANAHTAR', 'musteri-ahmet', 'example.com', 'kullanici', 'parola', 'AHMET', 'YILMAZ'];

  it('# parçası, kullanıcı bilgisi, yabancı alan adı ve javascript: gövdesi sızmaz', () => {
    kur(
      el('body', {},
        el('iframe', { id: 'fa', src: 'https://avukat.uyap.gov.tr/x#jsessionid=GIZLIOTURUM' }),
        el('iframe', { id: 'fb', src: 'https://musteri-ahmet.example.com/x;jsessionid=A1/y' }),
        el('iframe', { id: 'fc', src: 'https://kullanici:parola@esorgu.uyap.gov.tr:8443/ara' }),
        el('iframe', { id: 'fd', src: '//uyap.gov.tr.example.com/z' }),
        el('iframe', { id: 'fe', src: 'javascript:isle("AHMET YILMAZ")' }),
        el('iframe', { id: 'ff', src: '/a/jsessionid=GIZLIOTURUM/z' }),
      ),
      '?GIZLIANAHTAR&jsessionid=GIZLIOTURUM&dosya=1',
    );
    const r = sayfaIskeleti();
    const json = JSON.stringify(r);
    for (const s of GIZLI) expect(json, s).not.toContain(s);
    const cerceveler = (r.kok as unknown as { k: { cerceve: string }[] }).k.map((c) => c.cerceve);
    // UYAP alan adı kalır (yapıyı çözmek için gerekli); gerisi maskelenir.
    expect(cerceveler).toEqual([
      'avukat.uyap.gov.tr/x',
      '‹DIS_ALAN›/x',
      'esorgu.uyap.gov.tr/ara',
      '‹DIS_ALAN›/z',
      'javascript:‹n›',
      '/a/‹n›/z',
    ]);
    // Değersiz belirteç maskelenir; ad (değer değil) kalır.
    expect(r.sorguAdlari).toEqual(['‹n›', 'jsessionid', 'dosya']);
  });

  it('sayfanın kendi alan adı UYAP değilse adreste görünmez', () => {
    kur(el('body', {}, 'x'));
    g.location = { host: 'musteri-ahmet.example.com:8080', pathname: '/dosya/2023', search: '' };
    const r = sayfaIskeleti();
    expect(JSON.stringify(r)).not.toContain('example.com');
    expect(r.adres).toBe('‹DIS_ALAN›/dosya/‹n›');
  });
});
