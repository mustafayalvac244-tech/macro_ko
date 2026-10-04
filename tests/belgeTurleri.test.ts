import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { belgeSeciciTurleri, icerikTuru, kasaSeciciTurleri, udfMi } from '@/lib/belgeTurleri';
import { detectFileKind } from '@/utils/fileKind';

/**
 * UDF SEÇİLEBİLİR Mİ — 04.10.2026 avukat geri bildirimi ("UDF'de yüklemede
 * sıkıntı var"). Kusur ve gerekçe: src/lib/belgeTurleri.ts.
 */
describe('seçici türleri', () => {
  it('web: UDF uzantıyla süzgece girer', () => {
    const tur = belgeSeciciTurleri('web');
    expect(tur).toContain('.udf');
    expect(tur).toContain('.pdf');
    // '*/*' geçerli bir accept değeri değil; web listesinde işe yaramaz.
    expect(tur).not.toContain('*/*');
  });

  it('telefon: her dosya seçilebilir (UDF\'nin MIME türü yok)', () => {
    for (const p of ['ios', 'android']) {
      expect(belgeSeciciTurleri(p)).toContain('*/*');
      expect(kasaSeciciTurleri(p)).toContain('*/*');
      // Uzantı telefonda geçersiz MIME olur; listeye girmemeli.
      expect(belgeSeciciTurleri(p).some((x) => x.startsWith('.'))).toBe(false);
    }
  });

  it('kasa: görseller ve UDF birlikte', () => {
    expect(kasaSeciciTurleri('web')).toEqual(expect.arrayContaining(['.udf', 'image/*']));
    expect(kasaSeciciTurleri('ios')).toEqual(expect.arrayContaining(['image/*', '*/*']));
  });
});

describe('içerik türü', () => {
  it('tarayıcının boş verdiği türü uzantıdan bulur', () => {
    expect(icerikTuru('dilekce.udf', '')).toBe('application/octet-stream');
    expect(icerikTuru('karar.PDF', '')).toBe('application/pdf');
    expect(icerikTuru('x.docx', null)).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });
  it('gelen türü ezmez', () => {
    expect(icerikTuru('a.pdf', 'application/pdf')).toBe('application/pdf');
  });
  it('udfMi büyük/küçük harfe bakmaz', () => {
    expect(udfMi('EVRAK.UDF')).toBe(true);
    expect(udfMi('evrak.pdf')).toBe(false);
    expect(udfMi(undefined)).toBe(false);
  });
  it('UDF kendi türüyle tanınır', () => {
    expect(detectFileKind('', 'evrak.udf')).toBe('udf');
    expect(detectFileKind('application/octet-stream', 'Evrak.UDF')).toBe('udf');
  });
});

/**
 * KORUMA: seçiciyi kendi listesiyle çağıran yeni bir ekran UDF'yi yine
 * dışarıda bırakmasın. Tür listesi ya belgeTurleri'nden gelir ya da dosya
 * aşağıdaki gerekçeli istisnalardandır.
 */
const ISTISNA: Record<string, string> = {
  'app/toplu-aktar.tsx': 'yalnız CSV tablo okur; belge değil',
};

function dosyalar(kok: string): string[] {
  const out: string[] = [];
  for (const ad of readdirSync(kok)) {
    const yol = join(kok, ad);
    if (statSync(yol).isDirectory()) out.push(...dosyalar(yol));
    else if (/\.tsx?$/.test(ad)) out.push(yol);
  }
  return out;
}

describe('seçici çağrıları', () => {
  it('getDocumentAsync çağıran her dosya türleri belgeTurleri\'nden alır', () => {
    const kok = join(__dirname, '..');
    const ihlal: string[] = [];
    for (const d of [...dosyalar(join(kok, 'app')), ...dosyalar(join(kok, 'src'))]) {
      const goreli = d.slice(kok.length + 1).replace(/\\/g, '/');
      const metin = readFileSync(d, 'utf8');
      if (!metin.includes('getDocumentAsync(')) continue;
      if (ISTISNA[goreli]) continue;
      if (!/SeciciTurleri\(/.test(metin)) ihlal.push(goreli);
    }
    expect(ihlal).toEqual([]);
  });
});
