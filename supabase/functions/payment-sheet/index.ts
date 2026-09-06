// Vekil :: Stripe PaymentSheet arka ucu — KONTÖR SATIŞI.
//
// NE YAPIYOR. Oturum açmış kullanıcı için seçilen pakete ait bir PaymentIntent
// oluşturur ve istemciye client secret'ı döner.
//
// BU DOSYA KONTÖR YÜKLEMEZ ve YÜKLEMEMELİDİR. Kontör yalnız ödemenin
// GERÇEKTEN alındığı doğrulandıktan sonra yüklenir; bunun tek güvenli yeri
// Stripe'ın imzalı webhook'udur. İstemcinin "ödedim" demesine güvenip bakiye
// yazmak, bakiyeyi bedava dağıtmak olur.
//
// EKSİK HALKA (bilinçli olarak yazılmadı): webhook ucu. Yazılması için
// STRIPE_WEBHOOK_SECRET gerekiyor ve imza doğrulaması denenmeden yazılan ödeme
// kodu, denenmemiş her koddan daha tehlikelidir — para hatası sessiz olmaz ama
// geri de alınmaz. Webhook eklendiğinde yapacağı tek iş şudur:
//   payment_intent.succeeded → ai_kontor_yukle(metadata.user_id, tutar)
// Yükleme işlevi ve tablosu hazır (0055), imza doğrulaması yapılınca bağlanır.
//
// Kurulum: Edge Functions → payment-sheet → Secrets → STRIPE_SECRET_KEY.

import Stripe from 'npm:stripe@17';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * KONTÖR PAKETLERİ. Tutarlar kuruş cinsindendir (Stripe en küçük birimi ister).
 *
 * Fiyatlandırma iş kuralı: her istekte bir birim sağlayıcıya gider, iki birim
 * kâr kalır (ücret = maliyet × 3). Ölçülen maliyetlerle bir dilekçe 1,90 TL'ye
 * mal oluyor ve 5,70 TL'ye satılıyor; yani 100 TL'lik paket ≈ 17 dilekçe.
 *
 * Paket büyüdükçe küçük bir indirim var: peşin ödeme bizim için nakit akışı,
 * kullanıcı için de "ne kadar aldım" hissi yaratıyor.
 */
const PAKETLER: Record<string, { kurus: number; kontorTry: number; ad: string }> = {
  baslangic: { kurus: 10000, kontorTry: 100, ad: 'Vekil AI kontör — 100 TL' },
  orta: { kurus: 25000, kontorTry: 265, ad: 'Vekil AI kontör — 250 TL (+%6)' },
  buyuk: { kurus: 50000, kontorTry: 550, ad: 'Vekil AI kontör — 500 TL (+%10)' },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const secretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!secretKey) {
      return new Response(JSON.stringify({ error: 'not_configured' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // KİMLİK DOĞRULAMA ŞART. Önce yoktu: uç, kim olduğu bilinmeyen çağrılara
    // PaymentIntent üretiyordu. İki sonucu vardı — herkes ödeme niyeti
    // oluşturabiliyordu ve daha önemlisi, ödeme BAŞARILI olsa bile kontörün
    // KİME yükleneceği bilinemiyordu. Kullanıcı kimliği olmadan bu uç, iş
    // modelinin hiçbir işine yaramaz.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    );
    const { data: u, error: authErr } = await supabase.auth.getUser();
    if (authErr || !u.user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let body: { paket?: string } = {};
    try {
      body = await req.json();
    } catch {
      // gövdesiz istek: varsayılan pakete düşer
    }
    const paket = PAKETLER[body.paket ?? 'baslangic'] ?? PAKETLER.baslangic;

    const stripe = new Stripe(secretKey);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: paket.kurus,
      currency: 'try',
      automatic_payment_methods: { enabled: true },
      description: paket.ad,
      // METADATA, WEBHOOK'UN TEK BİLGİ KAYNAĞI. Ödeme onaylandığında kontörün
      // kime ve ne kadar yükleneceği buradan okunur; yazılmazsa başarılı bir
      // ödeme bile karşılıksız kalır.
      metadata: {
        user_id: u.user.id,
        paket: body.paket ?? 'baslangic',
        kontor_try: String(paket.kontorTry),
      },
    });

    return new Response(
      JSON.stringify({ clientSecret: paymentIntent.client_secret, kontorTry: paket.kontorTry }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
