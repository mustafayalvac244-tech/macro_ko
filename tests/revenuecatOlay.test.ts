import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { olayKarari, type RcOlay } from '../supabase/functions/_shared/revenuecatOlay';

/**
 * SATIN ALMA WEBHOOK'U — saf karar mantığı (10.10.2026 denetimi, ajan 25).
 *
 * Alan adları ve anlamlar RevenueCat'in resmî belgesinden (revenuecat.com/docs/
 * integrations/webhooks/event-types-and-fields, 10.10.2026'da okundu):
 *  - environment: SANDBOX | PRODUCTION (her olayda)
 *  - EXPIRATION: "The associated user's access should be removed."
 *  - BILLING_ISSUE: "doesn't mean the subscription has expired";
 *    grace_period_expiration_at_ms yalnız bu olayda, her zaman var (null olabilir)
 *  - CANCELLATION cancel_reason=BILLING_ERROR "as soon as the billing issue has
 *    been detected"; erişim EXPIRATION(BILLING_ERROR)'da kalkar
 *  - iade: CANCELLATION + cancel_reason=CUSTOMER_SUPPORT, price negatif
 *  - TRANSFER: transferred_from/transferred_to; belgede app_user_id ve
 *    entitlement_ids bu olay için listelenmiyor
 * SQL tarafının (sıra denetimi, yetki yeniden hesabı) davranışı yerel Postgres'te
 * scripts/migration-deneme/revenuecat-olcum.sql ile ölçülür.
 */

const U = '11111111-1111-4111-8111-111111111111';
const SIMDI = Date.parse('2026-10-10T12:00:00Z');
const GUN = 86_400_000;

const olay = (o: Partial<RcOlay> = {}): RcOlay => ({
  id: 'ev-1',
  type: 'RENEWAL',
  app_user_id: U,
  store: 'APP_STORE',
  environment: 'PRODUCTION',
  event_timestamp_ms: SIMDI - 1000,
  expiration_at_ms: SIMDI + 30 * GUN,
  entitlement_ids: ['premium'],
  price_in_purchased_currency: 399,
  currency: 'TRY',
  ...o,
});

function rpc(o: RcOlay) {
  const k = olayKarari(o, SIMDI);
  if ('atla' in k) throw new Error(`atlandı: ${k.atla}`);
  return k.rpc;
}

describe('atlanan olaylar sessiz kalmaz ve nedeni söylenir', () => {
  it('kimliksiz / türsüz olay atlanır', () => {
    expect(olayKarari({ type: 'RENEWAL' }, SIMDI)).toEqual({ atla: 'olay_alani_eksik' });
    expect(olayKarari(undefined, SIMDI)).toEqual({ atla: 'olay_alani_eksik' });
  });

  it('TRANSFER işlenmez ama nedeni "transfer" diye adlandırılır (app_user_id olmasa da)', () => {
    const k = olayKarari(
      { id: 'tr-1', type: 'TRANSFER', transferred_from: ['$RCAnonymousID:abc'], transferred_to: [U] },
      SIMDI
    );
    expect(k).toEqual({ atla: 'transfer' });
  });

  it('RevenueCat anonim kimliği ($RCAnonymousID) ayrı bir nedenle atlanır', () => {
    expect(olayKarari(olay({ app_user_id: '$RCAnonymousID:0123abcd' }), SIMDI)).toEqual({ atla: 'anonim_kimlik' });
  });

  it('UUID olmayan diğer kimlikler "taninmayan_app_user_id"', () => {
    expect(olayKarari(olay({ app_user_id: 'ahmet' }), SIMDI)).toEqual({ atla: 'taninmayan_app_user_id' });
    expect(olayKarari(olay({ app_user_id: undefined }), SIMDI)).toEqual({ atla: 'taninmayan_app_user_id' });
  });
});

describe('SANDBOX olayı atlanmaz (Apple inceleyicisi sandbox\'ta satın alır) ama ortamı işaretlenir', () => {
  it('SANDBOX olayı işlenir ve ortam SQL\'e iletilir', () => {
    const r = rpc(olay({ environment: 'SANDBOX' }));
    expect(r.p_environment).toBe('SANDBOX');
    expect(r.p_user).toBe(U);
    expect(r.p_expires_at).toBe(new Date(SIMDI + 30 * GUN).toISOString());
    expect(r.p_entitlement_ids).toEqual(['premium']);
  });

  it('PRODUCTION iletilir; bilinmeyen/eksik ortam null (SQL "bilinmiyor" sayar, sandbox saymaz)', () => {
    expect(rpc(olay({ environment: 'PRODUCTION' })).p_environment).toBe('PRODUCTION');
    expect(rpc(olay({ environment: undefined })).p_environment).toBeNull();
    expect(rpc(olay({ environment: 'sandbox ' })).p_environment).toBeNull();
  });
});

describe('olay sırası denetimi için olay zamanı iletilir', () => {
  it('event_timestamp_ms ISO olarak p_event_at\'e gider', () => {
    expect(rpc(olay({ event_timestamp_ms: SIMDI - 5000 })).p_event_at).toBe(new Date(SIMDI - 5000).toISOString());
  });

  it('olay zamanı yoksa null (SQL alınma anını kullanır)', () => {
    expect(rpc(olay({ event_timestamp_ms: undefined })).p_event_at).toBeNull();
  });

  it('geçersiz (Date aralığı dışı) milisaniye ÇÖKMEZ, null olur', () => {
    const r = rpc(olay({ event_timestamp_ms: 1e300, expiration_at_ms: Number.POSITIVE_INFINITY }));
    expect(r.p_event_at).toBeNull();
    expect(r.p_expires_at).toBeNull();
  });
});

describe('EXPIRATION erişimi kaldırır (belge: "access should be removed")', () => {
  it('expiration_at_ms yoksa bitiş olay anıdır; premium süresiz kalmaz', () => {
    const r = rpc(olay({ type: 'EXPIRATION', expiration_at_ms: null, event_timestamp_ms: SIMDI - 60_000 }));
    expect(r.p_expires_at).toBe(new Date(SIMDI - 60_000).toISOString());
  });

  it('expiration_at_ms de olay zamanı da yoksa bitiş şimdi', () => {
    const r = rpc(olay({ type: 'EXPIRATION', expiration_at_ms: null, event_timestamp_ms: undefined }));
    expect(r.p_expires_at).toBe(new Date(SIMDI).toISOString());
  });

  it('gelecekte görünen bir bitiş şimdiye çekilir (EXPIRATION sonrası erişim açık kalamaz)', () => {
    const r = rpc(olay({ type: 'EXPIRATION', expiration_at_ms: SIMDI + 3 * GUN }));
    expect(r.p_expires_at).toBe(new Date(SIMDI).toISOString());
  });

  it('geçmişteki bitiş olduğu gibi kalır', () => {
    const r = rpc(olay({ type: 'EXPIRATION', expiration_at_ms: SIMDI - 2 * GUN }));
    expect(r.p_expires_at).toBe(new Date(SIMDI - 2 * GUN).toISOString());
  });
});

describe('ek süre (grace period) — erişim EXPIRATION\'a kadar sürer', () => {
  it('BILLING_ISSUE: bitiş = max(expiration_at_ms, grace_period_expiration_at_ms)', () => {
    const r = rpc(
      olay({
        type: 'BILLING_ISSUE',
        expiration_at_ms: SIMDI - GUN,
        grace_period_expiration_at_ms: SIMDI + 15 * GUN,
      })
    );
    expect(r.p_expires_at).toBe(new Date(SIMDI + 15 * GUN).toISOString());
  });

  it('BILLING_ISSUE: ek süre null ise (kurulu değil) expiration_at_ms korunur', () => {
    const r = rpc(olay({ type: 'BILLING_ISSUE', expiration_at_ms: SIMDI - GUN, grace_period_expiration_at_ms: null }));
    expect(r.p_expires_at).toBe(new Date(SIMDI - GUN).toISOString());
  });

  it('BILLING_ISSUE: ek süre expiration_at_ms\'den KÜÇÜKSE erişim kısalmaz', () => {
    const r = rpc(
      olay({ type: 'BILLING_ISSUE', expiration_at_ms: SIMDI + 5 * GUN, grace_period_expiration_at_ms: SIMDI + GUN })
    );
    expect(r.p_expires_at).toBe(new Date(SIMDI + 5 * GUN).toISOString());
  });

  it('CANCELLATION + BILLING_ERROR: durum DEĞİŞTİRMEZ (bitiş null); erişimi EXPIRATION kapatır', () => {
    const r = rpc(olay({ type: 'CANCELLATION', cancel_reason: 'BILLING_ERROR', expiration_at_ms: SIMDI - GUN }));
    expect(r.p_expires_at).toBeNull();
  });
});

describe('iade', () => {
  it('CANCELLATION + CUSTOMER_SUPPORT + negatif tutar = iade: erişim şimdi kapanır', () => {
    const r = rpc(
      olay({
        type: 'CANCELLATION',
        cancel_reason: 'CUSTOMER_SUPPORT',
        price: -4.99,
        price_in_purchased_currency: -399,
        expiration_at_ms: SIMDI + 20 * GUN,
      })
    );
    expect(r.p_expires_at).toBe(new Date(SIMDI).toISOString());
    expect(r.p_amount).toBe(-399);
  });

  it('CUSTOMER_SUPPORT ama tutar negatif DEĞİL/yok: iade sayılmaz (ödenmiş erişim yanlışlıkla kesilmez)', () => {
    const exp = SIMDI + 20 * GUN;
    expect(
      rpc(olay({ type: 'CANCELLATION', cancel_reason: 'CUSTOMER_SUPPORT', price: null, expiration_at_ms: exp })).p_expires_at
    ).toBe(new Date(exp).toISOString());
    expect(
      rpc(olay({ type: 'CANCELLATION', cancel_reason: 'CUSTOMER_SUPPORT', price: 0, expiration_at_ms: exp })).p_expires_at
    ).toBe(new Date(exp).toISOString());
  });

  it('kullanıcı iptali (UNSUBSCRIBE) dönem sonuna kadar erişim bırakır', () => {
    const exp = SIMDI + 20 * GUN;
    const r = rpc(olay({ type: 'CANCELLATION', cancel_reason: 'UNSUBSCRIBE', expiration_at_ms: exp }));
    expect(r.p_expires_at).toBe(new Date(exp).toISOString());
  });
});

describe('diğer olaylar eskisi gibi', () => {
  it('RENEWAL: bitiş, tutar, para birimi, platform aynen geçer', () => {
    const r = rpc(olay());
    expect(r).toMatchObject({
      p_event_id: 'ev-1',
      p_event_type: 'RENEWAL',
      p_platform: 'ios',
      p_amount: 399,
      p_currency: 'TRY',
      p_entitlement_ids: ['premium'],
    });
  });

  it('entitlement_ids null/eksik: boş dizi (SQL yalnız denetim satırı yazar)', () => {
    expect(rpc(olay({ entitlement_ids: null })).p_entitlement_ids).toEqual([]);
    expect(rpc(olay({ entitlement_ids: undefined })).p_entitlement_ids).toEqual([]);
  });

  it('platform: PLAY_STORE → android, bilinmeyen → other', () => {
    expect(rpc(olay({ store: 'PLAY_STORE' })).p_platform).toBe('android');
    expect(rpc(olay({ store: undefined })).p_platform).toBe('other');
  });

  it('expiration_at_ms null (ömür boyu/tüketilebilir): bitiş null → yetki değişmez', () => {
    expect(rpc(olay({ type: 'NON_RENEWING_PURCHASE', expiration_at_ms: null })).p_expires_at).toBeNull();
  });
});

describe('göç 0205 (SQL) — dağıtım sırasında ödeme kaybolmaz ve yetki sızmaz', () => {
  const sql = readFileSync(join(__dirname, '..', 'supabase', 'migrations', '0205_revenuecat_sira_sandbox_sure.sql'), 'utf8');

  it('yeni imzada p_event_at ve p_environment ZORUNLU (varsayılansız): eski 8 anahtarlı çağrı yeni işleve eşleşip PGRST203 vermez', () => {
    const m = sql.match(/create or replace function public\.revenuecat_olay_isle\(\s*p_event_id text,[\s\S]*?\)\s*returns boolean/);
    expect(m).not.toBeNull();
    const imza = m![0];
    expect(imza).toMatch(/p_event_at timestamptz,/);
    expect(imza).toMatch(/p_environment text,/);
    expect(imza).not.toMatch(/p_event_at timestamptz\s+default/);
    expect(imza).not.toMatch(/p_environment text\s+default/);
  });

  it('eski 8 parametreli imza sarmalayıcı olarak KALIR (göç ile uç işlevi arası pencerede olaylar düşmez)', () => {
    expect(sql).toMatch(
      /create or replace function public\.revenuecat_olay_isle\(\s*p_event_id text,\s*p_user uuid,\s*p_event_type text,\s*p_platform text,\s*p_expires_at timestamptz,\s*p_entitlement_ids text\[\] default/
    );
    expect(sql).not.toMatch(/drop function[^;]*revenuecat_olay_isle/i);
  });

  it('üç fonksiyon da PUBLIC/anon/authenticated\'a kapatılır, yalnız service_role (0079 dersi)', () => {
    for (const ad of ['revenuecat_olay_isle', 'revenuecat_yetki_bitis', 'revenuecat_suresi_dolanlari_kapat']) {
      expect(sql).toContain(`'${ad}'`);
    }
    expect(sql).toMatch(/revoke all on function %s from public, anon, authenticated/);
    expect(sql).toMatch(/grant execute on function %s to service_role/);
  });

  it('sandbox olayının tutarı gelir toplamına girmez', () => {
    expect(sql).toMatch(/case when p_environment = 'SANDBOX' then null else p_amount end/);
  });

  it('yönetici sayaçları sandbox satırını dışlar (satın alma sayısı, ücretliye geçen)', () => {
    const adet = sql.match(/pu\.environment is distinct from 'SANDBOX'/g) ?? [];
    expect(adet.length).toBeGreaterThanOrEqual(3);
  });
});
