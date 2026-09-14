import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ŞEMA KAPSAMI — kodun sorguladığı her tablo kurulabiliyor mu?
 *
 * NEDEN VAR. 13.09.2026 denetiminde gerçek Postgres'te ölçüldü: kurulum
 * belgesinin tarif ettiği yol (yalnız `0001_init.sql`) uygulamanın sorguladığı
 * **29 tabloyu** oluşturmuyordu. Göçlerin tamamı da tek başına yetmiyordu —
 * 6 tablo yalnız `KURULUM.sql`'de tanımlı (icra modülünün tamamı dahil).
 *
 * O hatanın türü şudur: kod yeni bir tablo sorgulamaya başlar, tabloyu
 * oluşturan SQL başka bir yere yazılır ya da hiç yazılmaz, ve bu ancak
 * SIFIRDAN kurulum yapan biri (yeni ortam, felaket kurtarma, ikinci proje)
 * tarafından fark edilir. Canlıda tablo zaten elle açılmış olduğu için
 * geliştirici hiçbir şey görmez.
 *
 * Bu test o boşluğu statik olarak kapatır: Postgres istemez, saniyeler sürer.
 * Düşerse anlamı tektir — kodun kullandığı bir tablonun kurulum SQL'i yok.
 *
 * NE ÖLÇMEZ: sütunları, kısıtları, RLS politikalarını ve ÇALIŞTIRMA SIRASINI.
 * Yalnız "bu tabloyu oluşturan bir ifade var mı" sorusunu yanıtlar. Sıranın
 * doğruluğu gerçek Postgres'te ayrıca ölçüldü (bkz. KURULUM.md 4. madde).
 */

const KOK = join(__dirname, '..');

/** `.from('x')` çağrılarındaki tablo adları. */
function kodunTablolari(): Set<string> {
  const bulunan = new Set<string>();
  const gez = (dizin: string) => {
    for (const girdi of readdirSync(dizin, { withFileTypes: true })) {
      const yol = join(dizin, girdi.name);
      if (girdi.isDirectory()) {
        if (girdi.name === 'node_modules' || girdi.name.startsWith('.')) continue;
        gez(yol);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(girdi.name)) continue;
      const metin = readFileSync(yol, 'utf8');
      for (const m of metin.matchAll(/\.from\('([a-z][a-z0-9_]*)'\)/g)) {
        bulunan.add(m[1]);
      }
    }
  };
  for (const d of ['src', 'app', 'supabase/functions']) gez(join(KOK, d));
  return bulunan;
}

/** Kurulum SQL'lerinde `create table ... <ad>` ile geçen tablo adları. */
function kurulabilenTablolar(): Set<string> {
  const bulunan = new Set<string>();
  const oku = (yol: string) => {
    const metin = readFileSync(yol, 'utf8');
    for (const m of metin.matchAll(
      /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z][a-z0-9_]*)"?/gi,
    )) {
      bulunan.add(m[1].toLowerCase());
    }
  };
  const gocDizin = join(KOK, 'supabase', 'migrations');
  for (const ad of readdirSync(gocDizin)) {
    if (ad.endsWith('.sql')) oku(join(gocDizin, ad));
  }
  oku(join(KOK, 'KURULUM.sql'));
  return bulunan;
}

/**
 * Supabase'in kendi sağladığı, bizim kurmadığımız tablolar. Bunlar listede
 * olmadığı için "eksik" sayılmamalı.
 */
const SUPABASE_TABLOLARI = new Set(['objects', 'buckets', 'users']);

describe('şema kapsamı', () => {
  const kod = kodunTablolari();
  const kurulabilir = kurulabilenTablolar();

  it('kodun sorguladığı her tablonun kurulum SQL’i vardır', () => {
    const eksik = [...kod]
      .filter((t) => !SUPABASE_TABLOLARI.has(t))
      .filter((t) => !kurulabilir.has(t))
      .sort();

    expect(
      eksik,
      eksik.length
        ? `Bu tablolar kodda sorgulanıyor ama hiçbir göçte ya da KURULUM.sql'de ` +
          `oluşturulmuyor: ${eksik.join(', ')}. Sıfırdan kurulan bir ortamda bu ` +
          `özellikler çalışmaz.`
        : '',
    ).toEqual([]);
  });

  it('tarama gerçekten iş görüyor (boş küme değil)', () => {
    // Regex bir gün bozulursa test sessizce "hiç tablo yok, hepsi tamam" derdi.
    expect(kod.size).toBeGreaterThan(20);
    expect(kurulabilir.size).toBeGreaterThan(20);
  });

  it('icra modülü ve müvekkil avans defteri kurulabiliyor', () => {
    // Bu altısı yalnız KURULUM.sql'de tanımlı. Oradan silinirlerse ya da
    // KURULUM.sql taramadan çıkarılırsa bu test düşer.
    for (const t of [
      'enforcement_files',
      'enforcement_collections',
      'client_advances',
      'client_expenses',
      'ictihat_kararlar',
      'ictihat_harvest_state',
    ]) {
      expect(kurulabilir.has(t), `${t} kurulum SQL'inde yok`).toBe(true);
    }
  });
});
