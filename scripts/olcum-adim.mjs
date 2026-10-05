// ADIM SÜRESİ ÖLÇÜMÜ — MODEL ÇAĞRILMAZ, PARA HARCAMAZ (05.10.2026).
//
// Ürün sahibi: "performanstan memnun değiller". Sohbet 22–23 sn, dilekçe
// 58 sn sürüyordu (04.10 ölçüldü) ve ~20 sn modelin dışındaydı; NEREDE
// olduğu bilinmiyordu. Bu betik ai-chat'in KURU KOŞU dalını (x-kuru-kosu,
// yalnız servis anahtarı) çağırır: besleme ve denetim adımları gerçek
// soru + 04.10'da Sonnet'in GERÇEKTEN ürettiği cevap üzerinde koşar.
//
// Girdi: scripts/olcum-sonnet-sonuc.json (not = soru/olay, metin = cevap).
// Senaryoları ben seçmedim; 04.10 ölçümünün kendisi. Her biri TEKRAR kez.
// Çıktı: scripts/olcum-adim-sonuc.json
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const url = process.env.SUPABASE_URL;
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !svc) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY gerekli');

const TEKRAR = 2;
const kaynak = JSON.parse(readFileSync(join(__dirname, 'olcum-sonnet-sonuc.json'), 'utf8')).sonuclar
  .filter((x) => x.metin && x.not);
const sonuclar = [];
for (const k of kaynak) {
  for (let i = 1; i <= TEKRAR; i++) {
    const t0 = Date.now();
    const r = await fetch(`${url}/functions/v1/ai-chat`, {
      method: 'POST',
      headers: { apikey: svc, Authorization: `Bearer ${svc}`, 'Content-Type': 'application/json', 'x-kuru-kosu': '1' },
      body: JSON.stringify({ soru: k.not, cevap: k.metin }),
      signal: AbortSignal.timeout(150_000),
    });
    const duvarMs = Date.now() - t0;
    let veri = null;
    try { veri = await r.json(); } catch { veri = null; }
    const kayit = { tur: k.tur, id: k.id, tekrar: i, durum: r.status, duvarMs, ...(veri ?? {}) };
    sonuclar.push(kayit);
    console.log(`${k.tur}/${k.id} #${i}: HTTP ${r.status}, duvar ${duvarMs} ms, besleme ${veri?.beslemeMs} ms, denetim ${veri?.denetimMs} ms ${JSON.stringify(veri?.adimlar ?? {})}`);
    writeFileSync(join(__dirname, 'olcum-adim-sonuc.json'), JSON.stringify({ tarih: new Date().toISOString(), sonuclar }, null, 1));
  }
}
console.log('Bitti. Model çağrılmadı; harcama ₺0.');
