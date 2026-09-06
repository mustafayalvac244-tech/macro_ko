// Vekil :: Stripe webhook — KONTÖRÜN YÜKLENDİĞİ TEK YER.
//
// NEDEN BU DOSYA VAR. payment-sheet ucu PaymentIntent üretiyordu ama ödeme
// onaylandığında bakiyeyi yükleyecek halka yoktu: başarılı bir ödeme
// KARŞILIKSIZ kalıyordu. Kullanıcı parayı ödüyor, kontörü almıyordu — yani iş
// modeli hiç çalışmıyordu.
//
// KONTÖR YALNIZ BURADA YÜKLENİR. İstemcinin "ödedim" demesine güvenip bakiye
// yazmak, bakiyeyi bedava dağıtmak olur; ödemenin gerçekten alındığını
// söyleyebilecek tek taraf, isteği KENDİ ANAHTARIYLA İMZALAYAN Stripe'tır.
//
// İMZA DOĞRULANMADAN HİÇBİR ŞEY YAPILMAZ. Bu uç kimlik doğrulaması olmadan
// (verify_jwt: false) çalışmak zorunda — Stripe bizim JWT'mizi taşıyamaz. Yani
// URL'yi bilen herkes buraya istek gönderebilir. Tek koruma imza; imzasız
// gövde, tanımadığımız birinin yazdığı metindir ve içindeki user_id de
// tutar da uydurma olabilir.
//
// GÖVDE HAM OKUNUR (req.text()). İmza ham baytlar üzerinden hesaplanır; JSON'a
// çevirip yeniden yazmak imzayı bozar ve her istek reddedilirdi.
//
// TEKRAR KORUMASI VERİTABANINDA. Stripe aynı olayı ağ hatası ya da 2xx dönmeyen
// yanıt sonrası TEKRAR gönderir (belgelenmiş normal davranış). Koruma
// ai_odeme.event_id birincil anahtarında: ikinci kez gelen olay kaydı çakışır
// ve yükleme hiç çalışmaz (bkz. 0064).
//
// Kurulum: Edge Functions → stripe-webhook → Secrets → STRIPE_SECRET_KEY ve
// STRIPE_WEBHOOK_SECRET. Ayrıca bu ucun JWT doğrulaması KAPALI dağıtılmalıdır.

import Stripe from 'npm:stripe@17';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('method_not_allowed', { status: 405 });
  }

  const secretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  // AYARSIZ UÇ, AÇIK KAPI OLMAKTANSA KAPALI DURUR. İmza sırrı yoksa gövdeyi
  // doğrulayamayız; "sır yok, o hâlde doğrulamayı atlayalım" demek, ucu
  // herkese kontör dağıtan bir düğmeye çevirirdi.
  if (!secretKey || !webhookSecret) {
    return new Response(JSON.stringify({ error: 'not_configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const imza = req.headers.get('stripe-signature');
  if (!imza) {
    return new Response(JSON.stringify({ error: 'no_signature' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const govde = await req.text();
  const stripe = new Stripe(secretKey);

  // OLAY TİPİ YAPISAL. tsc, Deno'nun 'npm:' içe aktarmalarını çözemiyor; bu
  // yüzden Stripe.Event gibi ad uzayı tipleri burada yok. Yalnızca okuduğumuz
  // alanları yazmak, denetimi çalışır tutuyor — çözülemeyen tek bir tip, tip
  // denetiminin tamamını gürültüye çevirir.
  let olay: {
    id: string;
    type: string;
    data: { object: { id?: string; metadata?: Record<string, string> } };
  };
  try {
    // Deno'da SENKRON constructEvent ÇALIŞMAZ: Web Crypto asenkrondur ve
    // senkron sürüm "SubtleCryptoProvider cannot be used in a synchronous
    // context" hatası verir. Bu satırın async olması bir üslup tercihi değil.
    olay = await stripe.webhooks.constructEventAsync(govde, imza, webhookSecret);
  } catch (e) {
    // İmza tutmadı: gövde bizim bilmediğimiz biri tarafından yazılmış olabilir.
    // Ayrıntıyı dışarı vermiyoruz — imza denemesi yapan birine ipucu olmasın.
    console.error('stripe imza dogrulanamadi:', (e as Error).message);
    return new Response(JSON.stringify({ error: 'bad_signature' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // İlgilenmediğimiz olay türleri için 200 dönmek ŞART: 2xx dönmezsek Stripe
  // aynı olayı saatlerce tekrar dener ve gerçek olaylar kuyrukta bekler.
  if (olay.type !== 'payment_intent.succeeded') {
    return new Response(JSON.stringify({ ok: true, atlandi: olay.type }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const pi = olay.data.object;
  const userId = pi.metadata?.user_id ?? '';
  const kontor = Number(pi.metadata?.kontor_try ?? 0);

  // METADATA YOKSA YÜKLEME YOK. Bu uca bizim üretmediğimiz bir PaymentIntent de
  // düşebilir (aynı Stripe hesabından başka bir akış). Kime yükleyeceğimizi
  // bilmediğimiz bir ödemeyi tahminle bir kullanıcıya yazmak, parayı yanlış
  // hesaba koymaktır.
  if (!userId || !(kontor > 0)) {
    console.error('odeme metadata eksik:', pi.id, JSON.stringify(pi.metadata ?? {}));
    return new Response(JSON.stringify({ ok: true, atlandi: 'metadata_eksik' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data, error } = await db.rpc('ai_odeme_isle', {
    p_event_id: olay.id,
    p_user: userId,
    p_tutar: kontor,
    p_payment_intent: pi.id ?? null,
  });

  if (error) {
    // 500 DÖNMEK BURADA DOĞRU: Stripe tekrar dener ve geçici bir veritabanı
    // arızası yüzünden ödenmiş bir kontör kaybolmaz. Tekrar geldiğinde çift
    // yükleme olmaz, çünkü koruma olay kimliğinde (0064).
    console.error('kontor yuklenemedi:', olay.id, error.message);
    return new Response(JSON.stringify({ error: 'db' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // data null ise olay daha önce işlenmiş; bu bir hata değil, korumanın
  // çalıştığının işaretidir.
  return new Response(JSON.stringify({ ok: true, bakiye: data ?? null, tekrar: data === null }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
