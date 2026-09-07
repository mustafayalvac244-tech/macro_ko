// Vekil :: RevenueCat webhook — PREMIUM'UN GERÇEKTEN AÇILDIĞI TEK YER.
//
// NEDEN BU DOSYA VAR. premium.tsx'teki "Aboneliğe Geç" butonu şimdiye kadar
// sahteydi ("çok yakında" diyordu); is_premium yalnız admin panelinden elle
// açılıyordu. Bu uç, istemcinin App Store/Play Store'dan yaptığı GERÇEK
// satın almayı sunucuya bildiren tek yer — kontör akışındaki stripe-webhook
// ile birebir aynı ilke: istemcinin "ödedim" demesine güvenmiyoruz, yalnız
// mağazayla konuşan RevenueCat'in imzaladığı bildirime güveniyoruz.
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** RevenueCat "store" değerini bizim platform kısıtımıza indirger. */
function platformFromStore(store: string | undefined): string {
  const s = (store ?? '').toUpperCase();
  if (s === 'APP_STORE' || s === 'MAC_APP_STORE') return 'ios';
  if (s === 'PLAY_STORE') return 'android';
  if (s === 'STRIPE') return 'stripe';
  return 'other';
}

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

  const gelenYetki = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (gelenYetki !== webhookSecret) {
    console.error('revenuecat webhook: yetki basligi tutmadi');
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let govde: {
    event?: {
      id?: string;
      type?: string;
      app_user_id?: string;
      store?: string;
      expiration_at_ms?: number | null;
      // "price" HER ZAMAN USD'dir (RevenueCat dokümantasyonu: "USD price of
      // the transaction"). Yerel para birimindeki gerçek tutar ayrı bir
      // alanda gelir ve "currency" ile EŞLEŞEN odur — ikisini karıştırıp
      // price'ı currency ile birlikte kaydetmek yanlış denetim kaydı üretir
      // (ör. 4,99 USD tutarı "4,99 TRY" diye yazılır).
      price_in_purchased_currency?: number | null;
      currency?: string | null;
      environment?: string;
    };
  };
  try {
    govde = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'bad_json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const olay = govde.event;
  if (!olay?.id || !olay.type) {
    return new Response(JSON.stringify({ ok: true, atlandi: 'olay_alani_eksik' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // app_user_id, Purchases.logIn(supabaseUserId) ile İSTEMCİDE ayarlanır —
  // yani doğru akışta doğrudan Supabase kullanıcı kimliğidir. RevenueCat'in
  // KENDİ ürettiği anonim kimlikler ($RCAnonymousID:...) UUID biçiminde
  // DEĞİLDİR; böyle bir olay, henüz giriş yapmamış bir cihazdan gelmiştir ve
  // hangi kullanıcıya ait olduğunu bilemeyiz — işlemeden atlarız.
  const appUserId = olay.app_user_id ?? '';
  if (!UUID_RE.test(appUserId)) {
    return new Response(JSON.stringify({ ok: true, atlandi: 'taninmayan_app_user_id' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const expiresAt = typeof olay.expiration_at_ms === 'number' ? new Date(olay.expiration_at_ms).toISOString() : null;

  const { data, error } = await db.rpc('revenuecat_olay_isle', {
    p_event_id: olay.id,
    p_user: appUserId,
    p_event_type: olay.type,
    p_platform: platformFromStore(olay.store),
    p_expires_at: expiresAt,
    p_amount: typeof olay.price_in_purchased_currency === 'number' ? olay.price_in_purchased_currency : null,
    p_currency: olay.currency ?? 'TRY',
  });

  if (error) {
    // Yabancı anahtar ihlali (profiles.id yok — silinmiş/uydurma kullanıcı)
    // KALICI bir hatadır; tekrar denemek düzeltmez. Diğer her hata GEÇİCİDİR
    // (ör. bağlantı sorunu) — 500 dönüp RevenueCat'in tekrar denemesine izin
    // veriyoruz, aksi hâlde gerçek bir satın alma sessizce kaybolabilir.
    const kalici = /foreign key|violates/i.test(error.message);
    console.error('revenuecat olay islenemedi:', olay.id, error.message);
    return new Response(JSON.stringify({ error: kalici ? 'bilinmeyen_kullanici' : 'db' }), {
      status: kalici ? 200 : 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true, yeni: data === true, tekrar: data === false }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
