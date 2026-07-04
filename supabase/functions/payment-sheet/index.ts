// Vekil :: Stripe PaymentSheet backend
// Creates a PaymentIntent and returns its client secret to the app.
// Deploy in Supabase Dashboard → Edge Functions → New function → name it
// "payment-sheet", paste this file, then set the STRIPE_SECRET_KEY secret
// (Edge Functions → payment-sheet → Secrets). Use your Stripe TEST secret
// key (sk_test_...) while testing.

import Stripe from 'npm:stripe@17';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const secretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!secretKey) {
      return new Response(JSON.stringify({ error: 'STRIPE_SECRET_KEY is not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripe = new Stripe(secretKey);

    // Fixed test price: 199.00 TRY. Amounts are in the smallest currency unit.
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 19900,
      currency: 'try',
      automatic_payment_methods: { enabled: true },
      description: 'Vekil Premium (test)',
    });

    return new Response(JSON.stringify({ clientSecret: paymentIntent.client_secret }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
