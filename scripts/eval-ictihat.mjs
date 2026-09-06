#!/usr/bin/env node
// Vekil :: içtihat arama isabet ölçümü
// ---------------------------------------------------------------------------
// NEDEN VAR. Havuzda 7.100'den fazla karar var ve arama kalitesi BUGÜNE KADAR
// HİÇ ÖLÇÜLMEDİ. Ölçülmeyen şey iyileştirilemez: bugün mevzuat aramasında tam
// bunu yaşadık — üç "iyileştirme" denendi, üçü de ölçümde KÖTÜ çıktı ve
// elendi. Ölçüm olmasa üçü de yayına girerdi.
//
// Örnekleme sırasında görülen gerçek arıza: "kiracının temerrüdü nedeniyle
// tahliye" sorusuna ASLİYE TİCARET MAHKEMESİ kararları döndü. Ticaret mahkemesi
// konut tahliyesine bakmaz. Böyle bir sonuç avukat için yararsız değil,
// YANILTICIDIR: resmî görünür ve konuya ait değildir.
//
// ÖLÇÜT (bkz. ictihat-sorulari.json). Bir sonuç ancak şu ikisi birden olursa
// isabetli sayılır:
//   1. Zorunlu kelimelerin HEPSİ karar metninde geçiyor,
//   2. Kararı veren merci konuya bakabilecek bir merci.
// İkisi de KARAR İÇERİĞİNDEN okunur, kararın hasat etiketinden değil. Bu
// bilinçli: aramayı hasat etiketiyle iyileştirmeyi deneyeceğiz ve ölçüt de o
// etiket olsaydı, ölçüm çözümün kendisini doğrulardı.
//
// Ölçü: isabet@K — ilk K sonucun kaçta kaçı isabetli (K vars. 5).
//
// Kullanım:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/eval-ictihat.mjs
// Env:
//   EVAL_K    kaç sonuca bakılacağı (vars. 5)
//   EVAL_RPC  ölçülecek arama işlevi (vars. search_ictihat_fts)
//   EVAL_SORU virgülle ayrılmış soru kimlikleri (vars. hepsi)
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const url = (process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!url || !svc) {
  console.error('HATA: SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli.');
  process.exit(1);
}

const K = Number(process.env.EVAL_K ?? 5);
const RPC = process.env.EVAL_RPC ?? 'search_ictihat_fts';
const SECIM = (process.env.EVAL_SORU ?? '').split(',').map((x) => x.trim()).filter(Boolean);

const { sorular: tumSorular } = JSON.parse(readFileSync(join(__dirname, 'ictihat-sorulari.json'), 'utf8'));
if (SECIM.length) {
  const bilinmeyen = SECIM.filter((k) => !tumSorular.some((s) => s.id === k));
  if (bilinmeyen.length) throw new Error(`bilinmeyen soru: ${bilinmeyen.join(', ')}`);
}
const sorular = SECIM.length ? tumSorular.filter((s) => SECIM.includes(s.id)) : tumSorular;

/** Türkçe küçük harf: JS'in /i bayrağı 'İ' harfini 'i'ye katlamaz. */
const kucult = (x) => String(x ?? '').toLocaleLowerCase('tr');

async function ara(soru) {
  const res = await fetch(`${url}/rest/v1/rpc/${RPC}`, {
    method: 'POST',
    headers: { apikey: svc, Authorization: `Bearer ${svc}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: soru, match_count: K }),
  });
  if (!res.ok) throw new Error(`${RPC} ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return res.json();
}

/**
 * Kararın TAM METNİ gerekiyor: snippet yalnız ilk 320 karakter ve zorunlu
 * kelime kararın ortasında geçebilir. Snippet'e bakmak, isabetli kararı
 * isabetsiz saymak olurdu.
 */
async function tamMetin(idler) {
  if (!idler.length) return new Map();
  const liste = idler.map((x) => `"${x}"`).join(',');
  const res = await fetch(
    `${url}/rest/v1/ictihat_kararlar?select=id,daire,kurul,full_text&id=in.(${encodeURIComponent(liste)})`,
    { headers: { apikey: svc, Authorization: `Bearer ${svc}` } }
  );
  if (!res.ok) throw new Error(`karar metni alınamadı: ${res.status}`);
  const rows = await res.json();
  return new Map(rows.map((r) => [r.id, r]));
}

function isabetli(karar, soru) {
  if (!karar) return { ok: false, sebep: 'metin yok' };
  const metin = kucult(karar.full_text);
  const merci = kucult(`${karar.kurul ?? ''} ${karar.daire ?? ''}`);
  const eksik = (soru.zorunluKelime ?? []).filter((k) => !metin.includes(kucult(k)));
  if (eksik.length) return { ok: false, sebep: `kelime yok: ${eksik.join(', ')}` };
  const yasak = (soru.yasakMerci ?? []).find((m) => merci.includes(kucult(m)));
  if (yasak) return { ok: false, sebep: `yanlış merci: ${karar.daire || karar.kurul}` };
  return { ok: true };
}

let toplamIsabet = 0;
let toplamSonuc = 0;
const satirlar = [];

console.log(`İçtihat arama ölçümü · ${sorular.length} soru · isabet@${K} · ${RPC}\n`);

for (const s of sorular) {
  let sonuclar;
  try {
    sonuclar = await ara(s.soru);
  } catch (e) {
    console.log(`! ${s.id} → arama başarısız: ${String(e.message).slice(0, 120)}`);
    satirlar.push({ id: s.id, isabet: 0, donen: 0 });
    continue;
  }
  const metinler = await tamMetin(sonuclar.map((r) => r.id));
  let isabet = 0;
  const kusurlar = [];
  for (const r of sonuclar) {
    const d = isabetli(metinler.get(r.id), s);
    if (d.ok) isabet++;
    else kusurlar.push(`${r.daire || r.kurul || '?'} — ${d.sebep}`);
  }
  toplamIsabet += isabet;
  // PAYDA HER ZAMAN K. Dönen sonuç sayısını payda yapmak, AZ SONUÇ DÖNDÜRMEYİ
  // ÖDÜLLENDİRİRDİ: beş isteyip üç döndüren ve üçünü de tutturan arama %100
  // görünürdü. Oysa avukat için iki eksik sonuç, iki kayıp içtihattır.
  // Ölçülen durum: otuz soruya 150 yerine 110 sonuç döndü.
  toplamSonuc += K;
  satirlar.push({ id: s.id, isabet, donen: sonuclar.length });

  const isaret = isabet === K ? '✓' : isabet === 0 ? '✗' : '~';
  const eksikNot = sonuclar.length < K ? `  (yalnız ${sonuclar.length} sonuç döndü)` : '';
  console.log(`${isaret} ${s.id}  ${isabet}/${K}${eksikNot}`);
  for (const k of kusurlar.slice(0, 3)) console.log(`    ${k}`);
}

const oran = toplamSonuc ? (toplamIsabet / toplamSonuc) * 100 : 0;
console.log('\n' + '─'.repeat(60));
console.log(`İÇTİHAT: ${toplamIsabet}/${toplamSonuc} sonuç isabetli (%${oran.toFixed(1)}) · ${sorular.length} soru`);
const bosSoru = satirlar.filter((x) => x.donen === 0).length;
if (bosSoru) console.log(`Hiç sonuç dönmeyen soru: ${bosSoru}`);
const sifirIsabet = satirlar.filter((x) => x.donen > 0 && x.isabet === 0).length;
console.log(`Tek isabetli sonuç bile dönmeyen soru: ${sifirIsabet}/${sorular.length}`);
