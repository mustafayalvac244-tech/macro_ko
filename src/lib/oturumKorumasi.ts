import type { Session } from '@supabase/supabase-js';

/**
 * ÇEVRİMDIŞI AÇILIŞ İÇİN İKİ SAF YARDIMCI (09.10.2026) — bağımlılıksız, ki
 * birim testinde react-native/AsyncStorage olmadan sınansın. Kullanım yeri:
 * src/lib/supabase.ts (koruma + disk okuma) ve src/store/authStore.ts.
 */

type Fetch = typeof fetch;

/**
 * supabase-js'in oturumu sakladığı anahtar: createClient'ın VARSAYILAN
 * değeriyle aynı hesap (`sb-<proje>-auth-token`). İstemciye AYRICA
 * VERİLMEZ — hesap bir gün kütüphaneden ayrışırsa yalnız çevrimdışı açılış
 * yardımı susar, kimsenin oturumu kaybolmaz. Eşitliği
 * tests/oturumKorumasi.test.ts kütüphanenin kendisiyle karşılaştırarak korur.
 */
export function oturumAnahtari(supabaseUrl: string): string {
  return `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
}

/**
 * auth-js'in diskteki oturum kaydını çözer (JSON). auth-js'in kendi geçerlilik
 * şartı (access_token, refresh_token, expires_at) + uygulamanın kullandığı
 * user.id. Bozuk/eksikse null.
 */
export function diskOturumunuCoz(ham: string | null | undefined): Session | null {
  if (!ham) return null;
  try {
    const o = JSON.parse(ham) as Partial<Session> | null;
    if (
      o &&
      typeof o.access_token === 'string' &&
      typeof o.refresh_token === 'string' &&
      typeof o.expires_at === 'number' &&
      !!o.user &&
      typeof o.user.id === 'string'
    ) {
      return o as Session;
    }
  } catch {
    // bozuk kayıt: oturum yok say
  }
  return null;
}

/**
 * OTURUM AÇIKKEN İSTEK ANONİM GİTMESİN.
 *
 * supabase-js jeton alamadığında (yenileme ağ yüzünden düştü ya da auth-js
 * hata sonrası bekleme süresinde) isteği SESSİZCE anonim anahtarla gönderir:
 * `session?.access_token ?? supabaseKey`. Anonim istek RLS yüzünden hata değil
 * BOŞ LİSTE döner; çevrimdışı açılışta önbellekteki davalar, ağ geri geldiği
 * ilk dakikada boş listeyle ezilir ve avukat verisinin silindiğini sanar.
 *
 * Kural: kimlik uçları (/auth/v1/) dışındaki bir istek anonim taşıyıcıyla
 * gidiyorsa VE cihazda hâlâ bir oturum duruyorsa (auth-js ölmüş oturumu
 * siler, yenilenemeyeni tutar) istek gönderilmez, ağ hatası gibi düşer —
 * React Query önbelleği yerinde bırakır. Jeton yenilenince istekler
 * kendiliğinden normal gider. Çıkış yapılmışsa (disk boş) hiçbir şey değişmez.
 */
export function anonimIstekKorumasi(asil: Fetch, anonAnahtar: string, oturumDiskte: () => Promise<boolean>): Fetch {
  const anonimTasiyici = `Bearer ${anonAnahtar}`;
  const korumali = async (input: Parameters<Fetch>[0], init?: Parameters<Fetch>[1]) => {
    const adres = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!adres.includes('/auth/v1/') && new Headers(init?.headers).get('Authorization') === anonimTasiyici) {
      let oturumVar = false;
      try {
        oturumVar = await oturumDiskte();
      } catch {
        oturumVar = false;
      }
      if (oturumVar) throw new TypeError('Network request failed');
    }
    return asil(input, init);
  };
  return korumali as Fetch;
}
