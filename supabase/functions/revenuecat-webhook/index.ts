// Vekil :: RevenueCat webhook — PREMIUM/AI'NİN GERÇEKTEN AÇILDIĞI TEK YER.
//
// NEDEN BU DOSYA VAR. premium.tsx'teki "Aboneliğe Geç" butonu şimdiye kadar
// sahteydi ("çok yakında" diyordu); is_premium yalnız admin panelinden elle
// açılıyordu. Bu uç, istemcinin App Store/Play Store'dan yaptığı GERÇEK
// satın almayı sunucuya bildiren tek yer — kontör akışındaki stripe-webhook
// ile birebir aynı ilke: istemcinin "ödedim" demesine güvenmiyoruz, yalnız
// mağazayla konuşan RevenueCat'in imzaladığı bildirime güveniyoruz.
//
// İKİ AYRI ÜRÜN, İKİ AYRI ENTİTLEMENT. "premium" (temel, 399₺) is_premium'u,
// "ai" (2.999₺, 750 soru + 25 mütalaa — bkz. _shared/katman.ts) ai_tier'ı
// açar; bir olay entitlement_ids'inde İKİSİ BİRDEN de olabilir. Hangisinin
// hangi ürüne bağlı olduğu RevenueCat panelinde kurulur (bkz. IAP_KURULUM.md);
// biz burada yalnız RevenueCat'in söylediği entitlement_ids'e göre davranırız,
// "satın alma oldu = her şey açıldı" diye VARSAYMAYIZ (bkz. 0073).
//
// KİMLİK DOĞRULAMASI. Bu uç JWT'siz çalışmak zorunda (verify_jwt: false) —
// RevenueCat bizim oturum jetonumuzu taşıyamaz. Tek koruma, RevenueCat
// panelinde ayarlanan sabit Authorization başlığı; onu bilmeyen biri bu uca
// istek atsa da hiçbir şey işlenmez.
//
// TEKRAR KORUMASI VERİTABANINDA (bkz. 0072 > revenuecat_olay_isle). RevenueCat
// 2xx dönmeyen bir yanıtta AYNI olayı 5 kez, artan aralıklarla tekrar dener
// (belgelenmiş davranış) — bu yüzden geçici bir DB hatasında 500 dönmek
// doğrudur (tekrar denesin), ama "zaten işlendi" ya da "bu olayı
// işleyemeyiz" durumlarında her zaman 200 dönülür.
//
// Kurulum: Edge Functions → revenuecat-webhook → Secrets →
// REVENUECAT_WEBHOOK_SECRET (RevenueCat panelinde de AYNI değer, Webhooks →
// Authorization header alanına girilir). Bu ucun JWT doğrulaması KAPALI
// dağıtılmalıdır.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { olayKarari, type RcOlay } from '../_shared/revenuecatOlay.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('method_not_allowed', { status: 405 });
  }

  const webhookSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  // AYARSIZ UÇ, AÇIK KAPI OLMAKTANSA KAPALI DURUR (bkz. stripe-webhook, aynı ilke).
  if (!webhookSecret) {
    return new Response(JSON.stringify({ error: 'not_configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // "Bearer " ÖNEKİ VE BOŞLUK TOLERE EDİLİR (03.10.2026). RevenueCat panelindeki
  // örnek değer "Bearer Xz3a…" biçiminde; ürün sahibi kurarken test olayı 401
  // aldı. Karşılaştırılan şey yine sırrın KENDİSİ — önek/boşluk güvenlik
  // katmaz, yalnız yanlış kurulumu sessizce kırar.
  const sade = (v: string | null) => (v ?? '').trim().replace(/^Bearer\s+/i, '').trim();
  const gelenYetki = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!sade(gelenYetki) || sade(gelenYetki) !== sade(webhookSecret)) {
    console.error('revenuecat webhook: yetki basligi tutmadi');
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let govde: { event?: RcOlay };
  try {
    govde = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'bad_json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Ne işleneceği SAF mantıkta (_shared/revenuecatOlay.ts, testi
  // tests/revenuecatOlay.test.ts): sandbox işaretleme, olay zamanı, EXPIRATION,
  // ek süre (grace), iade. Burada yalnız uygulanır.
  const olay = govde?.event; // gövde "null" ise de çökmesin
  const karar = olayKarari(olay, Date.now());
  if ('atla' in karar) {
    // Atlanan olay SESSİZ KALMAZ (eskiden TRANSFER ve anonim kimlikli olaylar
    // hiçbir iz bırakmadan 200 dönüyordu). Kimlik yazılmaz; yalnız olay kimliği,
    // türü ve nedeni. TRANSFER'de kaç hesabın etkilendiği de yazılır.
    console.warn(
      'revenuecat olay atlandi:',
      olay?.id ?? '?',
      olay?.type ?? '?',
      karar.atla,
      karar.atla === 'transfer'
        ? `from=${olay?.transferred_from?.length ?? 0} to=${olay?.transferred_to?.length ?? 0}`
        : ''
    );
    return new Response(JSON.stringify({ ok: true, atlandi: karar.atla }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data, error } = await db.rpc('revenuecat_olay_isle', karar.rpc);

  if (error) {
    // Yabancı anahtar ihlali (profiles.id yok — silinmiş/uydurma kullanıcı)
    // KALICI bir hatadır; tekrar denemek düzeltmez. Diğer her hata GEÇİCİDİR
    // (ör. bağlantı sorunu) — 500 dönüp RevenueCat'in tekrar denemesine izin
    // veriyoruz, aksi hâlde gerçek bir satın alma sessizce kaybolabilir.
    const kalici = /foreign key|violates/i.test(error.message);
    console.error('revenuecat olay islenemedi:', olay?.id, error.message);
    return new Response(JSON.stringify({ error: kalici ? 'bilinmeyen_kullanici' : 'db' }), {
      status: kalici ? 200 : 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true, yeni: data === true, tekrar: data === false }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
