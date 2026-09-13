import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * SAĞLIK VERİSİ BU DEPOYA SIZMASIN — kuralın kod tarafındaki bekçisi.
 *
 * KURAL (ürün sahibi, 13.09.2026): "Sağlık verisini buraya karıştırma, hep
 * ayrı olacak." Gerekçesi AGENTS.md'de: sağlık verisi 6698 s.K. m.6 anlamında
 * ÖZEL NİTELİKLİ veridir; açık rıza ister, yeterli önlem zorunludur ve VERBİS
 * yükümlülüğü çalışan/ciro eşiklerinden bağımsız doğabilir. Avukatın müvekkil
 * dosyasıyla aynı yerde durması, Vekil Pro'nun uyum yükünü kendi işiyle ilgisi
 * olmayan bir sebeple ağırlaştırır.
 *
 * NEDEN TEST — çünkü kural yazıyla korunmaz. Aynı Supabase projesinde bir
 * eczane uygulamasının tabloları ZATEN bulundu (ilaclar, prospektusler,
 * kullanici_ilaclar, kullanici_alimlar); bizim migration'larımızda yoklar,
 * yani başka bir oturum doğrudan oluşturmuş. Aynısının BİZİM tarafımızdan
 * yapılmasını engelleyen tek şey bu testtir.
 *
 * NE YAPMAZ: canlı veritabanını denetlemez (onun aracı ayrı ve salt okunur —
 * scripts/saglik-verisi-ayrim.sql) ve hiçbir şeyi silmez.
 */

/** Sağlık/eczane alanına ait olduğu adından belli olan şema adları. */
const YASAK = [
  'ilaclar', 'prospektusler', 'kullanici_ilaclar', 'kullanici_alimlar',
  'receteler', 'recete_kalemleri', 'ilac_etkilesim', 'hastalar',
];

/** Bu dosyanın kendisi ve kuralı ANLATAN dosyalar doğal olarak kelimeleri içerir. */
const MUAF = [
  'saglikVerisiAyrimi.test.ts',
  'saglik-verisi-ayrim.sql',
  'AGENTS.md',
  'CLAUDE.md',
  'MIMARI-DEVIR.md',
];

function dosyalariTopla(kok: string, uzantilar: string[]): string[] {
  const cikti: string[] = [];
  const gez = (yol: string) => {
    for (const ad of readdirSync(yol)) {
      if (ad === 'node_modules' || ad === '.git' || ad === 'docs') continue;
      const tam = join(yol, ad);
      if (statSync(tam).isDirectory()) gez(tam);
      else if (uzantilar.some((u) => ad.endsWith(u)) && !MUAF.includes(ad)) cikti.push(tam);
    }
  };
  gez(kok);
  return cikti;
}

const KOK = new URL('..', import.meta.url).pathname;

describe('sağlık verisi bu depoya karışmıyor', () => {
  it('migration dosyalarında sağlık/eczane tablosu yok', () => {
    const yol = join(KOK, 'supabase', 'migrations');
    const bulgular: string[] = [];
    for (const dosya of dosyalariTopla(yol, ['.sql'])) {
      const metin = readFileSync(dosya, 'utf8').toLowerCase();
      for (const ad of YASAK) {
        // Tablo adı olarak geçiyorsa yakala; serbest metinde geçmesi yeterli
        // değil — ama migration'da serbest metin de zaten şüphelidir.
        if (new RegExp(`\\b${ad}\\b`).test(metin)) bulgular.push(`${dosya}: ${ad}`);
      }
    }
    expect(bulgular).toEqual([]);
  });

  it('uygulama ve uç işlevi kodunda sağlık/eczane tablosuna erişim yok', () => {
    const bulgular: string[] = [];
    for (const kok of ['src', 'app', join('supabase', 'functions')]) {
      for (const dosya of dosyalariTopla(join(KOK, kok), ['.ts', '.tsx'])) {
        const metin = readFileSync(dosya, 'utf8').toLowerCase();
        for (const ad of YASAK) {
          if (new RegExp(`\\b${ad}\\b`).test(metin)) bulgular.push(`${dosya}: ${ad}`);
        }
      }
    }
    expect(bulgular).toEqual([]);
  });

  it('aydınlatma metninde sağlık verisi bir KATEGORİ olarak sayılmıyor', () => {
    // Metin, üçüncü kişilerin dosyasında özel nitelikli veri ÇIKABİLECEĞİNİ
    // söylüyor (doğru ve gerekli bir uyarı). Ama BİZİM işlediğimiz veri
    // kategorileri arasında sağlık verisi OLMAMALI — olursa metin, ürünün
    // yapmadığı bir şeyi beyan etmiş olur.
    const metin = readFileSync(join(KOK, 'src', 'components', 'KvkkMetin.tsx'), 'utf8');
    const kategoriBolumu = metin.slice(
      metin.indexOf('İşlenen Kişisel Veri Kategorileri'),
      metin.indexOf('Üçüncü Kişilerin Verileri'),
    );
    expect(kategoriBolumu.length).toBeGreaterThan(100); // bölüm gerçekten bulundu
    expect(/sağlık verisi|reçete|ilaç geçmişi/i.test(kategoriBolumu)).toBe(false);
  });
});
