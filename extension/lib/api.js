/**
 * VEKİL PRO SUNUCU ERİŞİMİ — bağımlılıksız.
 *
 * NEDEN SDK YOK. Eklenti tek dosyalık, derleme adımı olmayan bir paket olsun
 * istiyoruz: derleme adımı, mağaza incelemesinde "kaynak kodla eşleşmiyor"
 * itirazına ve her güncellemede bir araç zinciri bakımına yol açıyor. Düz
 * `fetch` ile Supabase'in REST ve Functions uçlarına gitmek yeterli.
 *
 * ANAHTAR GİZLİ DEĞİL. Aşağıdaki anon anahtarı mobil uygulamanın içinde de
 * duruyor ve öyle olması gerekiyor (Stripe'ın publishable key'i gibi). Veriyi
 * koruyan şey anahtar değil, satır düzeyi güvenlik (RLS): her kullanıcı yalnız
 * kendi kayıtlarına erişebiliyor.
 */
const SUPABASE_URL = 'https://wjshlysfmeqlnfiibknj.supabase.co';
const ANON_KEY = 'sb_publishable_9m36QXWJNcSe9Wnaq5JVnw_agU37VsJ';

const OTURUM_ANAHTARI = 'vekil-oturum';

/**
 * OTURUM BELLEKTE TUTULUR, DİSKE YAZILMAZ (10.10.2026).
 *
 * `chrome.storage.session` tarayıcı kapanınca (ya da eklenti yeniden
 * yüklenince) silinir ve varsayılan olarak içerik betiklerine kapalıdır;
 * `storage.local` ise diske yazar ve bilgisayarı ele geçiren birinin elinde
 * kalıcı bir yenileme jetonu bırakırdı. Bedeli: tarayıcı her açıldığında bir
 * kez yeniden giriş. Bir hukuk ürününde bu bedel bilinçli olarak kabul edildi.
 * (Chrome 102+; manifest 114 ister, bkz. minimum_chrome_version.)
 */
export async function oturumOku() {
  const { [OTURUM_ANAHTARI]: o } = await chrome.storage.session.get(OTURUM_ANAHTARI);
  return o ?? null;
}

async function oturumYaz(o) {
  await chrome.storage.session.set({ [OTURUM_ANAHTARI]: o });
}

/** Eski sürümlerin diske bırakmış olabileceği kayıt (artık okunmaz) — silinir. */
export async function eskiOturumuSil() {
  await chrome.storage.local.remove(OTURUM_ANAHTARI);
}

export async function cikisYap() {
  await chrome.storage.session.remove(OTURUM_ANAHTARI);
  await eskiOturumuSil();
}

/**
 * E-posta + şifre ile giriş. Şifre YAZILMAZ; yalnız jetonlar belleğe girer.
 *
 * NEDEN PANELDE AYRI GİRİŞ VAR. Paneldeki uygulama başka bir origin'de
 * (vekilpro.app) çalışır; oradaki oturum eklentiye geçmez. "Sayfadan dosya
 * aç" sunucuya eklentinin kendi jetonuyla gider.
 */
export async function girisYap(email, sifre) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: sifre }),
  });
  const g = await r.json().catch(() => ({}));
  if (!r.ok || !g?.access_token) {
    const e = new Error(g?.error_description || g?.msg || 'giris_basarisiz');
    e.durum = r.status;
    throw e;
  }
  await oturumYaz({ access_token: g.access_token, refresh_token: g.refresh_token, user: g.user });
  return g.user;
}

/**
 * Süresi dolmuş erişim jetonunu yeniler.
 *
 * NEDEN ŞART: erişim jetonu bir saat yaşıyor. Yenileme olmadan eklenti her gün
 * yeniden şifre sorardı; kullanıcı da şifresini sık girmeye alışırdı — bu,
 * kimlik avına açık bir alışkanlıktır.
 */
async function jetonuYenile() {
  const o = await oturumOku();
  if (!o?.refresh_token) throw new Error('oturum_yok');
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: o.refresh_token }),
  });
  const g = await r.json();
  if (!r.ok) {
    await cikisYap();
    throw new Error('oturum_yok');
  }
  await oturumYaz({ access_token: g.access_token, refresh_token: g.refresh_token, user: g.user ?? o.user });
  return g.access_token;
}

/** Jeton eskimişse bir kez yenileyip tekrar dener. */
async function yetkiliIstek(yol, secenek = {}, tekrar = true) {
  const o = await oturumOku();
  if (!o?.access_token) throw new Error('oturum_yok');
  const r = await fetch(`${SUPABASE_URL}${yol}`, {
    ...secenek,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${o.access_token}`,
      'Content-Type': 'application/json',
      ...(secenek.headers ?? {}),
    },
  });
  if (r.status === 401 && tekrar) {
    await jetonuYenile();
    return yetkiliIstek(yol, secenek, false);
  }
  return r;
}

/** Dosyayı oluşturur. Sunucu tarafındaki plan limiti burada da geçerlidir. */
export async function davaOlustur(alanlar) {
  const o = await oturumOku();
  const r = await yetkiliIstek('/rest/v1/cases', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ ...alanlar, owner_id: o.user.id }),
  });
  const g = await r.json().catch(() => ({}));
  if (!r.ok) {
    // Plan limiti bir arıza değil, ürünün kuralı — çağıran taraf ayırt etsin.
    const m = /plan_limiti:([a-z]+):(\d+)/.exec(g?.message ?? '');
    throw new Error(m ? `plan_limiti:${m[1]}:${m[2]}` : g?.message || 'kayit_basarisiz');
  }
  return Array.isArray(g) ? g[0] : g;
}
