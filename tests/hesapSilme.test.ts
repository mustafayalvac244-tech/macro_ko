import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tr } from '@/i18n/tr';
import { en } from '@/i18n/en';
import { belgeYollari, depodanSil } from '../src/utils/hesapSilme';

// HESAP SİLME — "silindi" denip dosyaların depoda kalmaması (09.10.2026).
//
// storage-js hatayı FIRLATMAZ, `{ error }` döndürür (storage-js 2.110.0,
// dist/index.mjs handleOperation). authStore.deleteAccount her parçayı
// `.catch(() => {})` ile sarıyordu: catch hiç çalışmıyor, dönen hata da
// okunmuyordu. Belge listesi sorgusunun hatası da okunmuyordu — liste
// okunamazsa HİÇBİR dosya silinmeden hesap siliniyordu.

const KOK = join(__dirname, '..');

/** remove() taklidi: hangi parçaların istendiğini kaydeder. */
function sahteDepo(hataliParca: number | null) {
  const istenen: string[][] = [];
  const sil = async (yollar: string[]) => {
    istenen.push(yollar);
    return istenen.length === hataliParca
      ? { data: null, error: { message: 'Gateway Timeout', statusCode: '504' } }
      : { data: yollar.map((name) => ({ name })), error: null };
  };
  return { sil, istenen };
}

/** PostgREST taklidi: sunucu tavanı (max_rows) kadar satır verir. */
function sahteBelgeTablosu(toplam: number, tavan: number, hataliCagri: number | null = null) {
  const satirlar = Array.from({ length: toplam }, (_, i) => ({ file_path: `u/genel/${i}.pdf` }));
  let cagri = 0;
  const sayfaGetir = async (bas: number, son: number) => {
    cagri += 1;
    if (cagri === hataliCagri) return { data: null, error: { message: 'canceling statement due to statement timeout' } };
    const adet = Math.min(son - bas + 1, tavan);
    return { data: satirlar.slice(bas, bas + adet), error: null };
  };
  return { sayfaGetir, cagriSayisi: () => cagri };
}

describe('depodanSil — depo hatası yutulmaz', () => {
  it('bir parça hata dönerse FIRLATIR (hesap silme durur)', async () => {
    const { sil } = sahteDepo(2);
    const yollar = Array.from({ length: 250 }, (_, i) => `u/genel/${i}.pdf`);
    await expect(depodanSil(sil, yollar)).rejects.toMatchObject({ message: 'Gateway Timeout' });
  });

  it('hatadan sonraki parçalar denenmez', async () => {
    const { sil, istenen } = sahteDepo(1);
    const yollar = Array.from({ length: 250 }, (_, i) => `u/genel/${i}.pdf`);
    await depodanSil(sil, yollar).catch(() => {});
    expect(istenen).toHaveLength(1);
  });

  it('hata yoksa tüm yollar 100\'erlik parçalarla gönderilir', async () => {
    const { sil, istenen } = sahteDepo(null);
    const yollar = Array.from({ length: 250 }, (_, i) => `u/genel/${i}.pdf`);
    await depodanSil(sil, yollar);
    expect(istenen.map((p) => p.length)).toEqual([100, 100, 50]);
    expect(istenen.flat()).toEqual(yollar);
  });

  it('yol yoksa depoya hiç gidilmez', async () => {
    const { sil, istenen } = sahteDepo(null);
    await depodanSil(sil, []);
    expect(istenen).toHaveLength(0);
  });
});

describe('belgeYollari — liste eksiksiz okunur', () => {
  it('sorgu hatası "belge yok" sayılmaz, FIRLATIR', async () => {
    const { sayfaGetir } = sahteBelgeTablosu(10, 1000, 1);
    await expect(belgeYollari(sayfaGetir)).rejects.toMatchObject({ message: expect.stringMatching(/timeout/) });
  });

  it('sunucu tavanından (1000) fazla belge varsa hepsi toplanır', async () => {
    const { sayfaGetir } = sahteBelgeTablosu(2500, 1000);
    const yollar = await belgeYollari(sayfaGetir);
    expect(yollar).toHaveLength(2500);
    expect(new Set(yollar).size).toBe(2500);
  });

  it('sunucu tavanı bizim sayfa boyumuzdan küçükse de eksik kalmaz', async () => {
    // max_rows projede değiştirilmiş olabilir (ÖLÇÜLMEDİ); "sayfa boyundan az
    // geldi → bitti" kuralı burada ilk sayfada yanlışlıkla dururdu.
    const { sayfaGetir } = sahteBelgeTablosu(1200, 500);
    expect(await belgeYollari(sayfaGetir)).toHaveLength(1200);
  });

  it('ikinci sayfada hata olursa da FIRLATIR (yarım liste kullanılmaz)', async () => {
    const { sayfaGetir } = sahteBelgeTablosu(2500, 1000, 2);
    await expect(belgeYollari(sayfaGetir)).rejects.toBeTruthy();
  });

  it('boş ya da null yol atlanır', async () => {
    const sayfalar = [[{ file_path: 'a' }, { file_path: null }, { file_path: '' }, { file_path: 'b' }], []];
    let i = 0;
    const yollar = await belgeYollari(async () => ({ data: sayfalar[i++] ?? [], error: null }));
    expect(yollar).toEqual(['a', 'b']);
  });
});

describe('authStore.deleteAccount bu yardımcıları kullanıyor', () => {
  const kaynak = readFileSync(join(KOK, 'src/store/authStore.ts'), 'utf8');
  const bas = kaynak.indexOf('deleteAccount: async');
  const govde = kaynak.slice(bas, kaynak.indexOf('clearError:', bas));

  it('depo silmesi ve belge listesi yardımcıdan geçiyor', () => {
    expect(bas).toBeGreaterThan(-1);
    expect(govde).toContain('belgeYollari(');
    expect(govde).toContain('depodanSil(');
  });

  it('depo silmesinin hatası .catch ile yutulmuyor', () => {
    // [^;] — iç içe parantezi (remove(paths.slice(...))) geçer ama ifade
    // sınırını geçmez; yoksa sonraki signOut(...).catch satırına uzanırdı.
    expect(/\.remove\([^;]*?\)\s*\.catch\(/.test(govde)).toBe(false);
  });
});

// HESAP SİLME EKRANININ SÖYLEDİKLERİ (09.10.2026).
//
// 1) "yedek alınmaz" YANLIŞTI. Ölçülen: veritabanı içi yedekler var (21 gün +
//    12 ay; delete_account bunlardan da siliyor — canlıdaki işlev tanımı
//    pg_proc'tan okundu) ve Supabase'in platform yedeği Pro planda tutuluyor
//    (örgüt planı "pro", Supabase belgesi: son 7 günün günlük yedeği). Gizlilik
//    metni (app/privacy.tsx) bunu zaten doğru anlatıyordu; silme ekranı onunla
//    çelişiyordu.
// 2) Apple'ın hesap silme rehberi: "If a person has an auto-renewable
//    subscription, notify them that billing will continue through Apple and
//    ask them to cancel their subscription before continuing."
//    (developer.apple.com/support/offering-account-deletion-in-your-app,
//    09.10.2026'da okundu). Ekranda böyle bir uyarı yoktu.
describe('hesap silme ekranı metinleri', () => {
  const ekran = readFileSync(join(KOK, 'app/hesap-sil.tsx'), 'utf8');

  it('"yedek alınmaz / no backup" demiyor', () => {
    expect(tr['delAcc.note']).not.toMatch(/yedek alınmaz/i);
    expect(en['delAcc.note']).not.toMatch(/no backup/i);
  });

  it('platform yedeğinin kendiliğinden düştüğünü söylüyor (gizlilik metniyle aynı olgu)', () => {
    expect(tr['delAcc.note']).toMatch(/Supabase/);
    expect(en['delAcc.note']).toMatch(/Supabase/);
  });

  it('abonelik uyarısı ekranda ve iki dilde var', () => {
    expect(ekran).toContain("t('delAcc.abonelik')");
    expect((tr as Record<string, string>)['delAcc.abonelik']).toMatch(/İPTAL ETMEZ/);
    expect((en as Record<string, string>)['delAcc.abonelik']).toMatch(/does NOT cancel/);
  });

  it('abonelik yönetimi bağlantıları mağazaların BELGELEDİĞİ adresler', () => {
    // Apple: developer.apple.com/support/offering-account-deletion-in-your-app
    // Google: developer.android.com/google/play/billing/subscriptions
    expect(ekran).toContain("'https://apps.apple.com/account/subscriptions/'");
    expect(ekran).toContain("'https://play.google.com/store/account/subscriptions'");
  });
});
