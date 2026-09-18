import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALICILAR, RIZA_ZORUNLU } from '../src/config/kvkk';

/**
 * SİTEDEKİ METİN, KODUN GERÇEKTE YAPTIĞI ŞEYİ ANLATMAK ZORUNDA.
 *
 * NEDEN BU TEST VAR — ÜÇ GERÇEK HATA YÜZÜNDEN (hepsi 13.09.2026'da CANLIDA
 * yakalandı, hiçbiri kullanıcı tarafından bildirilmemişti):
 *
 *  1) docs/privacy.html ve app/privacy.tsx "kayıt ekranı şu an bu rızayı
 *     ZORUNLU tutmaktadır" diyordu. Oysa bir gün önce RIZA_ZORUNLU false'a
 *     çekilmiş ve kayıt ekranı rıza kutusu boşken de hesap açar hâle
 *     gelmişti. Metin, üstüne kendi uygulamamızı Kanun'a aykırılıkla
 *     suçlamaya devam ediyordu. Bayrak değişti, metin değişmedi.
 *
 *  2) Aynı iki metin "oturum bilgileriniz cihazınızda şifreli alanda
 *     (SecureStore) tutulur" diyordu. Kod bunu yapmıyor: src/lib/supabase.ts
 *     oturumu AsyncStorage'a yazıyor, SecureStore yalnız cihaz kimliği için
 *     kullanılıyor (src/lib/cihazKimligi.ts). Yanlış bir GÜVENLİK iddiası,
 *     hiç iddia etmemekten kötüdür: kullanıcı olmayan bir korumaya güvenir.
 *
 *  3) docs/index.html'deki S.S.S. "dava, müvekkil ve finans kayıtlarınızı
 *     CSV olarak dışa aktarabilirsiniz" diyordu; CSV dışa aktarma yalnız
 *     gelir-gider ekranında var.
 *
 * Üçü de aynı kusurun belirtisi: metin bir yerde, gerçek başka yerde. Bu
 * testin işi, o ikisini birbirine bağlamak.
 *
 * NE YAPMAZ: metnin hukuken yeterli olduğunu söylemez. Yalnız "kodun
 * söylediği ile sitenin söylediği aynı mı" sorusunu yanıtlar.
 */

const KOK = new URL('..', import.meta.url).pathname;
const oku = (...yol: string[]) => readFileSync(join(KOK, ...yol), 'utf8');

describe('web metinleri kodla tutarlı', () => {
  it('rıza zorunlu DEĞİLKEN hiçbir metin "zorunlu" demiyor', () => {
    // Bayrak bir gün tekrar true yapılırsa bu test kendiliğinden anlamsız
    // hâle gelmesin diye koşul açıkça yazılı: kontrol yalnız bayrak false
    // iken çalışır, true olduğunda ters yönde çalışır.
    const metinler = {
      'docs/privacy.html': oku('docs', 'privacy.html'),
      'app/privacy.tsx': oku('app', 'privacy.tsx'),
      'docs/index.html': oku('docs', 'index.html'),
      'docs/guvenlik.html': oku('docs', 'guvenlik.html'),
    };
    for (const [ad, metin] of Object.entries(metinler)) {
      // Yorum satırları hariç tutuluyor: bu dosyalarda hatanın NE OLDUĞUNU
      // anlatan yorumlar var ve onların içinde tabii ki "zorunlu" geçiyor.
      const govde = metin
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      if (!RIZA_ZORUNLU) {
        expect(
          /rızayı ZORUNLU|rızayı zorunlu|bu rızayı zorunlu tut|consent[^.]{0,40}REQUIRES|currently REQUIRES this consent/i.test(govde),
          `${ad}: rıza isteğe bağlı olduğu hâlde metin "zorunlu" diyor`,
        ).toBe(false);
      }
    }
  });

  it('hiçbir metin oturum anahtarının SecureStore\'da durduğunu söylemiyor', () => {
    // Kod gerçekten SecureStore'a geçerse bu testin beklentisi de değişmeli
    // — ama o zaman supabase.ts'te storage alanı değişmiş olacağı için
    // aşağıdaki ikinci beklenti düşecek ve değiştirmek gerektiğini söyleyecek.
    const istemci = oku('src', 'lib', 'supabase.ts');
    expect(istemci).toContain('storage: AsyncStorage');
    expect(/SecureStore/.test(istemci)).toBe(false);

    for (const yol of [['docs', 'privacy.html'], ['app', 'privacy.tsx'], ['docs', 'guvenlik.html']]) {
      const govde = oku(...yol)
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      expect(
        /oturum[^.]{0,60}SecureStore|Session credentials[^.]{0,60}SecureStore/i.test(govde),
        `${yol.join('/')}: oturum anahtarı için olmayan bir şifreli kasa iddia ediliyor`,
      ).toBe(false);
    }
  });

  it('güvenlik sayfası, koddaki sağlayıcıların HEPSİNİ sayıyor', () => {
    // Bir sağlayıcı kvkk.ts'e eklenip bu sayfa unutulursa, aydınlatma metni
    // ile site birbirinden ayrışır — KVKK m.10 bakımından da sorun.
    const sayfa = oku('docs', 'guvenlik.html');
    const eksik = ALICILAR.map((a) => a.ad.split('(')[0].trim()).filter((ad) => !sayfa.includes(ad));
    expect(eksik).toEqual([]);
  });

  it('içtihat/CSV gibi olmayan bir yetenek vaat edilmiyor', () => {
    const sayfa = oku('docs', 'index.html').replace(/<!--[\s\S]*?-->/g, '');
    // CSV dışa aktarma yalnız gelir-gider ekranında çağrılıyor; dava ve
    // müvekkil listesi için düğme yok. O düğme eklendiğinde bu beklenti de
    // gevşetilmeli — ve o an exportCsv yeni bir ekrandan çağrılacağı için
    // aşağıdaki ikinci beklenti düşüp haber verecek.
    expect(/dava, müvekkil ve finans kayıtlarınızı tablo \(CSV\)/i.test(sayfa)).toBe(false);

    const finans = oku('app', 'finance.tsx');
    expect(finans).toContain("from '@/utils/exportCsv'");
  });

  it('yapısal veri (JSON-LD) geçerli ve sorular sayfadakiyle aynı', () => {
    const sayfa = oku('docs', 'index.html');
    const blok = sayfa.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    expect(blok, 'index.html içinde JSON-LD bloğu bulunamadı').toBeTruthy();

    const veri = JSON.parse(blok![1]); // geçersiz JSON burada patlar
    const graf: Array<Record<string, unknown>> = veri['@graph'];
    const sss = graf.find((d) => d['@type'] === 'FAQPage') as
      | { mainEntity: Array<{ name: string }> }
      | undefined;
    expect(sss, 'JSON-LD içinde FAQPage yok').toBeTruthy();

    // Sayfada GÖRÜNMEYEN bir soruyu işaretlemek Google'ın kurallarına
    // aykırı ve ayrıca sayfanın iki ayrı şey söylemesi demek.
    const basliklar = [...sayfa.matchAll(/<summary>([\s\S]*?)<\/summary>/g)]
      .map((m) => m[1].replace(/<[^>]*>/g, '').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim());
    const sayfadaYok = sss!.mainEntity.map((s) => s.name).filter((ad) => !basliklar.includes(ad));
    expect(sayfadaYok).toEqual([]);

    // Satın alınamayan bir plana arama sonucunda fiyat bastırmıyoruz; olmayan
    // bir puana yıldız da bastırmıyoruz.
    const dump = JSON.stringify(veri);
    expect(/aggregateRating|reviewCount|ratingValue/i.test(dump)).toBe(false);
  });

  /**
   * TEVKİL PANOSU AÇIKKEN METİNLER SUSAMAZ.
   *
   * NEDEN — bu tam olarak bir kez olmuş bir hata. Pano ve sohbet ekranları
   * kodda çalışır durumdaydı ama `docs/privacy.html`, `KvkkMetin.tsx` ve
   * `docs/guvenlik.html`'de "ilan", "tevkil", "mesaj", "pano" kelimeleri
   * SIFIR kez geçiyordu (YAYIN-DENETIMI.md → C2). Ekranlar bu yüzden
   * yayından çıkarılmıştı; 14.09.2026'da metinler yazıldıktan SONRA geri
   * açıldı.
   *
   * Bu test o sırayı kilitliyor: rota dosyası varsa metin de olmak zorunda.
   * Rotalar bir gün tekrar kaldırılırsa test kendiliğinden anlamsızlaşmasın
   * diye koşul açıkça yazılı — kontrol yalnız rota VARKEN çalışır.
   */
  it('pano rotası varken gizlilik metinleri ondan bahsediyor', () => {
    const rotaVar = existsSync(join(KOK, 'app', 'tevkil.tsx'));
    if (!rotaVar) return; // pano kapalıysa metinlerin susması doğrudur

    const metinler = {
      'src/components/KvkkMetin.tsx': oku('src', 'components', 'KvkkMetin.tsx'),
      'docs/privacy.html': oku('docs', 'privacy.html'),
      'docs/guvenlik.html': oku('docs', 'guvenlik.html'),
    };
    for (const [ad, ham] of Object.entries(metinler)) {
      // Yorum satırları sayılmıyor: bu dosyalarda hatanın NE OLDUĞUNU anlatan
      // yorumlar var ve onların içinde tabii ki "pano" geçiyor. Kullanıcının
      // GÖRDÜĞÜ metin aranıyor.
      const govde = ham.replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*\/\/.*$/gm, '');
      expect(/tevkil|pano/i.test(govde), `${ad}: pano açık ama metin ondan hiç bahsetmiyor`).toBe(true);
    }

    // Eski ve artık yanlış olan mutlak cümle geri gelmesin. "paylaşma ...
    // diye bir şey yoktur" pano açıkken yanlış beyandır.
    const gizlilik = metinler['docs/privacy.html'].replace(/<!--[\s\S]*?-->/g, '');
    expect(
      /Programda paylaşma, ekip ya da ikinci kullanıcı diye bir şey yoktur/i.test(gizlilik),
      'docs/privacy.html: pano açıkken "paylaşma diye bir şey yoktur" denemez',
    ).toBe(false);
  });

  /**
   * ANDROID'DE PANO GERÇEKTEN YOK — PLAY.md 4.3 buna dayanıyor.
   *
   * Ankette "kullanıcılar birbirini göremez" cevabı, özelliğin mobil pakette
   * BULUNMAMASINA dayanıyor; menüden gizlenmiş olması yetmez (daha önceki
   * hata tam buydu: ekran menüde yoktu ama rota olarak duruyordu).
   *
   * İki şart birlikte: (1) her web ekranının platformsuz bir karşılığı var,
   * (2) o karşılık gerçek ekranı değil "yalnız web" notunu gösteriyor.
   */
  it('her web-only ekranın native karşılığı var ve pano kodu içermiyor', () => {
    const kok = join(KOK, 'src', 'components', 'tevkil');
    if (!existsSync(kok)) return;

    for (const web of readdirSync(kok).filter((f) => f.endsWith('.web.tsx'))) {
      const native = web.replace('.web.tsx', '.tsx');
      expect(
        existsSync(join(kok, native)),
        `${web} için ${native} yok — Android'de gerçek ekran açılır ve Play cevabı yanlış beyana döner`,
      ).toBe(true);
      expect(
        readFileSync(join(kok, native), 'utf8').includes('YalnizWeb'),
        `${native} YalnizWeb göstermiyor; native tarafa işlevsel ekran sızmış olabilir`,
      ).toBe(true);
    }
  });

  /**
   * TOPLANAN HER VERİ KATEGORİSİ AYDINLATMA METNİNDE SAYILMAK ZORUNDA.
   *
   * GERÇEK EKSİK (18.09.2026'da ölçülerek bulundu, kullanıcı bildirmemişti):
   * kayıt ekranı T.C. kimlik numarasını ZORUNLU alıyor
   * (app/(auth)/signup.tsx: `if (!tcNo.trim()) eksik('tcNo', ...)`), ama
   * üç metnin üçü de "Kimlik: ad, soyad" diyip kimlik numarasını hiç
   * saymıyordu. Aynı şekilde `clients` tablosunda `tc_no` ve `address`,
   * `purchases` tablosunda satın alma kaydı var; hiçbiri sayılmıyordu.
   *
   * Kanun m.10 aydınlatma yükümlülüğünün ilk unsuru "işlenen kişisel veri
   * kategorileri"dir. Eksik sayım, metnin kendisini sakat bırakır — ve bu
   * eksiklik Apple/Play veri etiketlerine de aynen yansır, çünkü etiketler
   * bu listeden dolduruluyor.
   *
   * NE YAPMAZ: metnin hukuken yeterli olduğunu söylemez. Yalnız "kodun
   * TOPLADIĞI alan metinde geçiyor mu" sorusunu yanıtlar.
   */
  it('kod bir veri alanı topluyorsa aydınlatma metinleri onu sayıyor', () => {
    const govdesi = (ham: string) =>
      ham.replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*\/\/.*$/gm, '');

    const metinler = {
      'docs/privacy.html': govdesi(oku('docs', 'privacy.html')),
      'app/privacy.tsx': govdesi(oku('app', 'privacy.tsx')),
      'src/components/KvkkMetin.tsx': govdesi(oku('src', 'components', 'KvkkMetin.tsx')),
    };

    // 1) Kayıt ekranı kimlik numarasını zorunlu alıyor mu? Metne değil KODA
    //    bakılıyor; alan bir gün isteğe bağlı olursa test kendiliğinden
    //    gevşer, silinmesi gerekmez.
    const kayit = oku('app', '(auth)', 'signup.tsx');
    const kimlikZorunlu = /if \(!tcNo\.trim\(\)\)/.test(kayit);
    if (kimlikZorunlu) {
      for (const [ad, metin] of Object.entries(metinler)) {
        // "kimlik numarası" tek başına aranmaz: müvekkil kaydına ait cümle de
        // o kelimeleri içeriyor ve testi sahte biçimde geçirir. Bu tam olarak
        // olan şeydi — kontrol yazıldı, geçti, sonra metin silinince YİNE
        // geçti. Aranan şey kullanıcının KENDİ kaydına özgü ibare.
        expect(
          /kayıt sırasında zorunludur|kayıtta zorunludur|required at sign-up/i.test(metin),
          `${ad}: kayıt ekranı T.C. kimlik numarasını zorunlu alıyor ama metin onu hesap bilgisi olarak saymıyor`,
        ).toBe(true);
      }
    }

    // 2) Müvekkil kaydında kimlik numarası ve adres alanları var mı?
    const musteriTipi = oku('src', 'types', 'database.ts');
    const musteriKimlik = /tc_no: string \| null;/.test(musteriTipi);
    const musteriAdres = /address: string \| null;/.test(musteriTipi);
    if (musteriKimlik && musteriAdres) {
      for (const [ad, metin] of Object.entries(metinler)) {
        expect(
          /müvekkilin T\.?C\.? kimlik numaras[^.]{0,40}adres|client’s national ID number and address/i.test(metin),
          `${ad}: müvekkil kaydı kimlik no ve adres tutuyor ama metin bunu söylemiyor`,
        ).toBe(true);
      }
    }

    // 3) Satın alma defteri var mı? (purchases tablosu)
    const satinAlmaVar = existsSync(join(KOK, 'supabase', 'migrations', '0011_purchases.sql'));
    if (satinAlmaVar) {
      for (const [ad, metin] of Object.entries(metinler)) {
        expect(
          /Satın alma|Purchases:/i.test(metin),
          `${ad}: satın alma kaydı tutuluyor ama metin onu bir kategori olarak saymıyor`,
        ).toBe(true);
      }
    }
  });
});
