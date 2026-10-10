import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tr } from '@/i18n/tr';
import { en } from '@/i18n/en';

/**
 * MÜVEKKİL SİLİNİNCE NE GİDER, NE KALIR — onay metni şemayla aynı olmalı.
 *
 * BULUNAN KUSUR (09.10.2026). Onay metni yalnız "Bağlı davalar silinmez,
 * atanmamış olarak kalır" diyordu. Oysa alacak/taksit (payment_promises),
 * masraf avansı (client_advances) ve elle masraf (client_expenses) satırları
 * `on delete cascade` ile müvekkille birlikte KALICI olarak siliniyor; avukat
 * bunu onaylarken bilmiyordu.
 *
 * Canlı şema 09.10.2026'da pg_constraint'ten okundu (salt okunur): clients'a
 * bağlanan 7 yabancı anahtar var — 3 cascade, 4 set null. Aşağıdaki BEKLENEN
 * tablosu o ölçümdür. Göç dosyalarına clients'a bağlı YENİ bir tablo eklenirse
 * ilk test düşer: onay metni ve silme sonrası önbellek tazeleme
 * (src/lib/muvekkilOnbellegi.ts) birlikte gözden geçirilsin diye.
 */
const KOK = join(__dirname, '..');
const SQL_DOSYALARI = [
  ...readdirSync(join(KOK, 'supabase/migrations'))
    .filter((a) => a.endsWith('.sql'))
    .map((a) => join(KOK, 'supabase/migrations', a)),
  // client_advances ve client_expenses YALNIZ burada tanımlı (göç dosyası yok).
  join(KOK, 'KURULUM.sql'),
];

/** Göç dosyalarındaki `references clients (id) on delete …` tanımları: tablo → davranış. */
function clientsYabanciAnahtarlari(): Record<string, string> {
  const sonuc: Record<string, string> = {};
  for (const dosya of SQL_DOSYALARI) {
    let tablo: string | null = null;
    for (const satir of readFileSync(dosya, 'utf8').split('\n')) {
      const kod = satir.replace(/--.*$/, '');
      const olustur = /create table (?:if not exists )?(?:public\.)?(\w+)/i.exec(kod);
      if (olustur) tablo = olustur[1]!.toLowerCase();
      if (!/references (?:public\.)?clients\s*\(\s*id\s*\)/i.test(kod)) continue;
      const degistir = /alter table (?:if exists )?(?:public\.)?(\w+)/i.exec(kod);
      const davranis = /on delete (cascade|set null|set default|restrict|no action)/i.exec(kod);
      sonuc[(degistir?.[1] ?? tablo ?? '?').toLowerCase()] = (davranis?.[1] ?? 'no action').toLowerCase();
    }
  }
  return sonuc;
}

const BEKLENEN: Record<string, string> = {
  payment_promises: 'cascade',
  client_advances: 'cascade',
  client_expenses: 'cascade',
  cases: 'set null',
  documents: 'set null',
  enforcement_files: 'set null',
  powers_of_attorney: 'set null',
};

/** Her bağlı tablonun onay metninde anılma biçimi: [tr, en]. */
const METINDE: Record<string, [string, string]> = {
  payment_promises: ['alacak', 'receivable'],
  client_advances: ['avans', 'advance'],
  client_expenses: ['masraf', 'expense'],
  cases: ['dava', 'case'],
  documents: ['belge', 'document'],
  enforcement_files: ['icra', 'enforcement'],
  powers_of_attorney: ['vekalet', 'power'],
};

const cumleler = (metin: string) => metin.split(/(?<=[.?!])\s+/);

describe('müvekkil silme — şema', () => {
  it('clients yabancı anahtarları canlıda ölçülen 7 kayıtla aynı (3 cascade, 4 set null)', () => {
    expect(clientsYabanciAnahtarlari()).toEqual(BEKLENEN);
  });
});

describe('müvekkil silme — onay metni şemayı söylüyor', () => {
  const tablolar = Object.entries(clientsYabanciAnahtarlari());
  const silinen = tablolar.filter(([, d]) => d === 'cascade').map(([t]) => t);
  const kalan = tablolar.filter(([, d]) => d === 'set null').map(([t]) => t);

  it('tr: cascade ile gidenler "silinir" cümlesinde, kalanlar "silinmez" cümlesinde', () => {
    const c = cumleler(tr['client.deleteConfirm'].toLocaleLowerCase('tr-TR'));
    const silinirCumlesi = c.find((s) => s.includes('silinir')) ?? '';
    const silinmezCumlesi = c.find((s) => s.includes('silinmez')) ?? '';
    for (const t of silinen) expect(silinirCumlesi, t).toContain(METINDE[t]![0]);
    for (const t of kalan) expect(silinmezCumlesi, t).toContain(METINDE[t]![0]);
  });

  it('en: cascade ile gidenler "permanently deleted" cümlesinde, kalanlar "kept" cümlesinde', () => {
    const c = cumleler(en['client.deleteConfirm'].toLowerCase());
    const silinirCumlesi = c.find((s) => s.includes('permanently deleted')) ?? '';
    const silinmezCumlesi = c.find((s) => s.includes('kept')) ?? '';
    for (const t of silinen) expect(silinirCumlesi, t).toContain(METINDE[t]![1]);
    for (const t of kalan) expect(silinmezCumlesi, t).toContain(METINDE[t]![1]);
  });
});
