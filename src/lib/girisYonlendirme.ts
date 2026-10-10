/**
 * OTURUM BEKÇİSİ KARARLARI — saf, expo-router'dan bağımsız (AJAN 28, 10.10.2026).
 *
 * BULUNAN KUSURLAR (denetimde iddia edildi; kod okunarak doğrulandı):
 *  - Oturum kontrolü yalnız `app/(app)/_layout.tsx` içindeydi. Kökteki ~35
 *    ekran (/ai-chat, /case-form, /settings, /finance …) oturumsuz derin
 *    bağlantıyla AÇILIYOR ve her sorgu RLS yüzünden boş döndüğü için boş /
 *    hatalı ekran gösteriyordu.
 *  - (app) için oturum yoksa girişe yönlendirme vardı ama istenen adres
 *    unutuluyordu: giriş yapınca kullanıcı hedefe değil ana sayfaya düşüyordu.
 *  - Çıkışta `router.replace` yalnız en üst ekranı değiştiriyor; altındaki
 *    ekranlar yığında kalıyordu (geri tuşu eski ekranlara götürüyordu).
 *
 * Cihazda/tarayıcıda DENENMEDİ; karar mantığı birim testle (tests/
 * girisYonlendirme.test.ts) sabitlendi, yönlendirme çağrıları
 * src/hooks/useOturumBekcisi.ts içinde.
 */

/**
 * Oturum olmadan açılabilen KÖK ekranlar (segmentin ilk parçası).
 * (auth): giriş/kayıt · forgot-password: şifre sıfırlama (OTP kodlu, oturumsuz)
 * privacy/terms/kvkk: kayıt ekranından bağlanan metinler · +not-found: 404.
 * 'index' kökte yalnız yönlendirme yapar.
 */
const HERKESE_ACIK = ['(auth)', 'forgot-password', 'privacy', 'terms', 'kvkk', '+not-found', 'index'];

/** (app) grubunun kendi bekçisi var (app/(app)/_layout.tsx). */
const KENDI_BEKCISI_VAR = '(app)';

export function herkeseAcikMi(segmentler: readonly string[]): boolean {
  return segmentler.length === 0 || HERKESE_ACIK.includes(segmentler[0]);
}

export type BekciKarari = 'yok' | 'girise-at' | 'cikis' | 'hedefi-birak';

export interface BekciGirdisi {
  /** authStore.isInitializing — oturum diskten henüz okunmadı. */
  baslatiliyor: boolean;
  oturumVar: boolean;
  /** Bu uygulama çalışmasında en az bir kez oturum GÖRÜLDÜ (çıkış ayrımı için). */
  oturumGoruldu: boolean;
  segmentler: readonly string[];
}

export function bekciKarari(g: BekciGirdisi): BekciKarari {
  // Oturum okunmadan karar verme: ilk karede session her zaman null, derin
  // bağlantı yolda kaybolurdu (bkz. (app)/_layout.tsx'teki 15.09 ölçümü).
  if (g.baslatiliyor) return 'yok';

  if (g.oturumVar) {
    // Uygulamanın içine varıldı: girişten sonra gidilecek bekleyen hedef
    // artık bayat. Giriş/şifre-sıfırlama ekranındayken KORUNUR — yönlendirme
    // henüz yapılmamış olabilir.
    return herkeseAcikMi(g.segmentler) ? 'yok' : 'hedefi-birak';
  }

  // Oturum vardı, şimdi yok: çıkış (kendi isteğiyle ya da sunucu düşürdü).
  // Yığındaki eski ekranlar temizlenmeli.
  if (g.oturumGoruldu) return 'cikis';

  if (herkeseAcikMi(g.segmentler) || g.segmentler[0] === KENDI_BEKCISI_VAR) return 'yok';
  return 'girise-at';
}

// ---------------------------------------------------------------------------
// Girişten sonra gidilecek hedef — modül belleğinde (uygulama çalıştığı sürece).
// ---------------------------------------------------------------------------

const VARSAYILAN_HEDEF = '/(app)';
let bekleyenHedef: string | null = null;

/** Yalnız uygulama içi, giriş ekranlarına/köke/dışarıya çıkmayan adresler. */
function guvenliHedefMi(yol: string): boolean {
  if (!yol.startsWith('/') || yol.startsWith('//')) return false;
  const govde = yol.split('?')[0];
  if (govde === '/') return false;
  return !/^\/(\(auth\)|login|signup|forgot-password)(\/|$)/.test(govde);
}

export function girisHedefiniSakla(yol: string): void {
  if (guvenliHedefMi(yol)) bekleyenHedef = yol;
}

/**
 * Bekleyen hedef ya da ana ekran. OKUMA SİLMEZ: giriş ekranının hem
 * düzen-yönlendirmesi hem düğmesi aynı hedefi görmeli; silme
 * `girisHedefiniBirak` ile, uygulamaya varılınca yapılır.
 */
export function girisHedefi(): string {
  return bekleyenHedef ?? VARSAYILAN_HEDEF;
}

export function girisHedefiVarMi(): boolean {
  return bekleyenHedef !== null;
}

export function girisHedefiniBirak(): void {
  bekleyenHedef = null;
}

type ParamDegeri = string | string[] | undefined;

/**
 * Yol + sorgu dizgesi. Dinamik parçalar (/cases/[id]) yolda zaten çözülmüş
 * durumda; expo-router bunları parametre olarak da verir, sorguya tekrar
 * yazılmaz.
 */
export function girisHedefiYolu(pathname: string, params: Record<string, ParamDegeri> = {}): string {
  const parcalar = new Set(pathname.split('/').filter(Boolean).map((p) => {
    try {
      return decodeURIComponent(p);
    } catch {
      return p;
    }
  }));
  const sorgu = new URLSearchParams();
  for (const [anahtar, deger] of Object.entries(params)) {
    if (deger === undefined) continue;
    for (const d of Array.isArray(deger) ? deger : [deger]) {
      if (parcalar.has(d)) continue;
      sorgu.append(anahtar, d);
    }
  }
  const s = sorgu.toString();
  return s ? `${pathname}?${s}` : pathname;
}
