// RevenueCat webhook olayı → veritabanı çağrısı kararı. SAF mantık (Deno'ya,
// ağa, veritabanına bağlı değil): revenuecat-webhook/index.ts yalnız bu
// kararı uygular. Testi: tests/revenuecatOlay.test.ts.
//
// ALAN ADLARI VE ANLAMLAR yalnız RevenueCat'in resmî belgesinden alındı
// (revenuecat.com/docs/integrations/webhooks/event-types-and-fields,
// 10.10.2026'da okundu). Belgede olmayan bir davranış VARSAYILMAZ:
//  - environment: "SANDBOX" | "PRODUCTION", her olayda var.
//  - event_timestamp_ms: olayın üretildiği an; yeniden denemelerde AYNI değer.
//    Belge: "doesn't necessarily coincide with when the action ... occurred".
//    Sıra denetimi için elimizdeki tek alan bu; kusuru bilinerek kullanılıyor.
//  - EXPIRATION: "The associated user's access should be removed."
//  - BILLING_ISSUE: "doesn't mean the subscription has expired";
//    grace_period_expiration_at_ms yalnız bu olayda ve her zaman bulunur
//    (null olabilir).
//  - CANCELLATION, cancel_reason=BILLING_ERROR: faturalama sorunu fark edilir
//    edilmez gelir; erişim, ek süre bittiğinde gelen EXPIRATION
//    (expiration_reason=BILLING_ERROR) ile kalkar.
//  - İade: CANCELLATION, cancel_reason=CUSTOMER_SUPPORT; price "negative for
//    refunds".
//  - TRANSFER: transferred_from / transferred_to dizileri; belge bu olay için
//    app_user_id ya da entitlement_ids LİSTELEMİYOR ve nasıl işleneceğini
//    söylemiyor → işlenmez (ürün sahibi kararı bekliyor), ama sessiz kalmaz:
//    uç işlevi nedenini loglar.

export interface RcOlay {
  id?: string;
  type?: string;
  app_user_id?: string;
  store?: string;
  environment?: string;
  event_timestamp_ms?: number | null;
  expiration_at_ms?: number | null;
  grace_period_expiration_at_ms?: number | null;
  cancel_reason?: string | null;
  // "price" HER ZAMAN USD'dir; yerel para birimindeki tutar ayrı alanda gelir
  // ve "currency" ile EŞLEŞEN odur — denetim kaydına yalnız o yazılır.
  price?: number | null;
  price_in_purchased_currency?: number | null;
  currency?: string | null;
  entitlement_ids?: string[] | null;
  transferred_from?: string[] | null;
  transferred_to?: string[] | null;
}

/** public.revenuecat_olay_isle (göç 0205) çağrı gövdesi. */
export interface RpcGirdisi {
  p_event_id: string;
  p_user: string;
  p_event_type: string;
  p_platform: string;
  p_expires_at: string | null;
  p_event_at: string | null;
  p_environment: 'SANDBOX' | 'PRODUCTION' | null;
  p_entitlement_ids: string[];
  p_amount: number | null;
  p_currency: string;
}

export type OlayKarari = { atla: string } | { rpc: RpcGirdisi };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** RevenueCat "store" değerini bizim platform kısıtımıza indirger. */
export function platformFromStore(store: string | undefined): string {
  const s = (store ?? '').toUpperCase();
  if (s === 'APP_STORE' || s === 'MAC_APP_STORE') return 'ios';
  if (s === 'PLAY_STORE') return 'android';
  if (s === 'STRIPE') return 'stripe';
  return 'other';
}

/** Geçerli bir milisaniye değeri mi? (Date aralığı dışı ya da sayı olmayan DEĞİL.) */
function msGecerli(ms: unknown): ms is number {
  return typeof ms === 'number' && Number.isFinite(ms) && Math.abs(ms) <= 8.64e15;
}

function iso(ms: number | null): string | null {
  return ms === null ? null : new Date(ms).toISOString();
}

/** Geçersiz değer null olur — `new Date(1e300).toISOString()` RangeError atıp
 *  olayı 500'e düşürür, RevenueCat 5 kez boşuna tekrar denerdi. */
function msOrNull(ms: unknown): number | null {
  return msGecerli(ms) ? ms : null;
}

function ortam(v: string | undefined): 'SANDBOX' | 'PRODUCTION' | null {
  return v === 'SANDBOX' || v === 'PRODUCTION' ? v : null;
}

/** Bu olayın "erişim bitişi"ni belirler. null = bu olay yetki durumunu DEĞİŞTİRMEZ. */
function etkinBitis(olay: RcOlay, simdi: number): number | null {
  const bitis = msOrNull(olay.expiration_at_ms);
  const olayAni = msOrNull(olay.event_timestamp_ms);

  switch (olay.type) {
    case 'EXPIRATION':
      // Belge: erişim kaldırılmalı. Bitiş alanı yoksa eskiden hiçbir şey
      // değişmiyor ve premium SÜRESİZ açık kalıyordu; gelecekte görünen bitiş
      // de erişimi açık bırakırdı. İkisi de şimdiye/olay anına çekilir.
      return Math.min(bitis ?? olayAni ?? simdi, simdi);

    case 'BILLING_ISSUE': {
      // Ek süre (grace period) varsa erişim onun sonuna kadar sürer; yoksa
      // (alan null) expiration_at_ms. Hangisi büyükse o — erişimi KISALTMAZ.
      const ek = msOrNull(olay.grace_period_expiration_at_ms);
      if (bitis === null) return ek;
      return ek === null ? bitis : Math.max(bitis, ek);
    }

    case 'CANCELLATION': {
      // Faturalama hatası: ek süre içinde erişim sürer, EXPIRATION kapatır.
      // Bu satır durum satırı OLMAMALI (yoksa BILLING_ISSUE'nun ek süresini ezer).
      if (olay.cancel_reason === 'BILLING_ERROR') return null;
      // İade: CUSTOMER_SUPPORT + negatif tutar. İkisi BİRDEN aranır — "destek
      // iptali" iade olmak zorunda değil; ödenmiş erişim yanlışlıkla kesilmesin.
      const iadeTutari = [olay.price, olay.price_in_purchased_currency].some(
        (p) => typeof p === 'number' && p < 0
      );
      if (olay.cancel_reason === 'CUSTOMER_SUPPORT' && iadeTutari) {
        return Math.min(bitis ?? simdi, simdi);
      }
      return bitis;
    }

    default:
      return bitis;
  }
}

/**
 * Bir webhook olayını "atla (nedeniyle)" ya da "şu RPC gövdesiyle işle" olarak
 * karara bağlar. SANDBOX olayı ATLANMAZ: Apple inceleyicisi satın almayı
 * sandbox'ta yapar, atlamak incelemeyi kırar; yalnız ortamı işaretlenir ve
 * tutarı gelire girmez (SQL tarafı).
 */
export function olayKarari(olay: RcOlay | undefined | null, simdiMs: number): OlayKarari {
  if (!olay?.id || !olay.type) return { atla: 'olay_alani_eksik' };

  // TRANSFER'de app_user_id belgede yok; kimlik denetiminden ÖNCE ayrılır ki
  // neden "taninmayan_app_user_id" diye karışmasın.
  if (olay.type === 'TRANSFER') return { atla: 'transfer' };

  // app_user_id, Purchases.logIn(supabaseUserId) ile İSTEMCİDE ayarlanır —
  // doğru akışta doğrudan Supabase kullanıcı kimliğidir. RevenueCat'in KENDİ
  // ürettiği anonim kimlikler ($RCAnonymousID:...) UUID değildir: henüz giriş
  // yapmamış bir cihazdan gelmiştir, kime ait olduğunu bilemeyiz.
  const appUserId = olay.app_user_id ?? '';
  if (!UUID_RE.test(appUserId)) {
    return { atla: appUserId.startsWith('$RCAnonymousID') ? 'anonim_kimlik' : 'taninmayan_app_user_id' };
  }

  return {
    rpc: {
      p_event_id: olay.id,
      p_user: appUserId,
      p_event_type: olay.type,
      p_platform: platformFromStore(olay.store),
      p_expires_at: iso(etkinBitis(olay, simdiMs)),
      p_event_at: iso(msOrNull(olay.event_timestamp_ms)),
      p_environment: ortam(olay.environment),
      p_entitlement_ids: Array.isArray(olay.entitlement_ids) ? olay.entitlement_ids : [],
      p_amount: typeof olay.price_in_purchased_currency === 'number' ? olay.price_in_purchased_currency : null,
      p_currency: olay.currency ?? 'TRY',
    },
  };
}
