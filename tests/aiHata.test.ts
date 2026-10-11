import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { aiHataMetni, ictihatHataAnahtari, ictihatHataTuru } from '../src/lib/aiHata';
import { tr } from '../src/i18n/tr';
import { en } from '../src/i18n/en';

/**
 * Kota mesajı, kullanıcının o gün ürünü kullanıp kullanamayacağını belirliyor.
 * Ücretsiz sağlayıcının kotası KAYAN pencereyle yenileniyor ("try again in
 * 22m36s") ama mesajımız "yarın tekrar deneyin" diyordu: avukatı 23 dakika
 * beklemesi gerekirken ertesi güne yolluyorduk.
 */
const t = ((anahtar: string, p?: Record<string, string | number>) =>
  p ? `${anahtar}:${JSON.stringify(p)}` : anahtar) as unknown as Parameters<typeof aiHataMetni>[1];

describe('aiHataMetni', () => {
  it('kısa bekleme varsa dakikayı söyler', () => {
    expect(aiHataMetni({ error: 'daily_quota', yeniden: 1356 }, t)).toBe('ai.errQuotaWait:{"dk":"23"}');
  });

  it('bekleme yoksa günlük kota mesajına düşer', () => {
    expect(aiHataMetni({ error: 'daily_quota' }, t)).toBe('ai.errDailyQuota');
  });

  it('çok uzun beklemede dakika saymaz', () => {
    // "9 saat sonra" demek, o gün için kapalı demektir; dakika saymak yardımcı olmaz.
    expect(aiHataMetni({ error: 'daily_quota', yeniden: 9 * 3600 }, t)).toBe('ai.errDailyQuota');
  });

  it('bir dakikadan kısa beklemeyi sıfır dakika göstermez', () => {
    expect(aiHataMetni({ error: 'rate_limit', yeniden: 20 }, t)).toBe('ai.errQuotaWait:{"dk":"1"}');
  });

  it('aylık tavan aşımını kota mesajıyla karıştırmaz', () => {
    expect(aiHataMetni({ error: 'quota_exceeded' }, t)).toBe('ai.errQuota');
  });

  it('kontör bitmesini kotayla karıştırmaz', () => {
    // Kontör beklemekle gelmez, yükleme gerektirir; "biraz sonra tekrar
    // deneyin" demek kullanıcıyı boşuna bekletirdi.
    expect(aiHataMetni({ error: 'kontor_bitti' }, t)).toBe('ai.errKontor');
    expect(aiHataMetni({ error: 'kontor_bitti', yeniden: 600 }, t)).toBe('ai.errKontor');
  });

  it('bizim günlük hakkımızı sağlayıcı kotasıyla karıştırmaz', () => {
    // Sağlayıcı kotası dakikalar içinde açılabilir; günlük adil kullanım hakkı
    // gece yarısı yenilenir. Aynı mesaj, kullanıcıyı yanlış beklentiye sokardı.
    expect(aiHataMetni({ error: 'gunluk_hak_bitti' }, t)).toBe('ai.errDailyCap');
  });

  it('mütalaanın kapalı olmasını kotayla karıştırmaz', () => {
    // Beklemek ya da kontör yüklemek bunu açmaz: ücretli model gelene kadar
    // kapalı. Ölçümde ücretsiz katmanın küçük modeli olmayan kanunlara atıf
    // yapan bir mütalaa üretti; uydurulmuş mütalaa eksiğinden tehlikelidir.
    expect(aiHataMetni({ error: 'mutalaa_model_yok' }, t)).toBe('ai.errMutalaaKapali');
  });

  it('yaşam boyu deneme hakkını aylık kotayla karıştırmaz', () => {
    // Deneme hakkı hiç yenilenmez (kontör/kota gibi değil); abonelik gerekir.
    expect(aiHataMetni({ error: 'deneme_hakki_bitti' }, t)).toBe('ai.errDenemeBitti');
  });

  it('KVKK rıza eksikliğini "arıza" gibi göstermez', () => {
    // Bu bir arıza değil kuraldır: rıza olmadan metin yurt dışına gönderilemez.
    // Genel hataya düşseydi kullanıcı "tekrar deneyin" mesajı görür ve sonsuza
    // kadar denerdi — çözüm tek bir yerde, Ayarlar'daki imza ekranında.
    expect(aiHataMetni({ error: 'kvkk_riza_yok' }, t)).toBe('ai.errKvkkRiza');
    // Bekleme süresi gelse bile beklemekle açılmaz.
    expect(aiHataMetni({ error: 'kvkk_riza_yok', yeniden: 600 }, t)).toBe('ai.errKvkkRiza');
  });

  it('rıza kaydının OKUNAMAMASINI, rıza VERİLMEMESİYLE karıştırmaz', () => {
    // Bozuk ölçüm aleti geçerli ölçüm gibi görünmemeli: ikisi tek mesaja
    // bağlansaydı, imzasını çoktan atmış kullanıcı "gidin imzalayın" mesajı
    // görür, gider imzalar, yine açılmaz ve gerçek arıza görünmez kalırdı.
    expect(aiHataMetni({ error: 'kvkk_kontrol_hatasi' }, t)).toBe('ai.errKvkkKontrol');
    expect(aiHataMetni({ error: 'kvkk_kontrol_hatasi' }, t)).not.toBe(aiHataMetni({ error: 'kvkk_riza_yok' }, t));
  });

  // 08.10.2026: 'upstream' (sunucu tarafı arıza) eskiden genel "internetinizi
  // kontrol edin" mesajına düşüyordu — yanlış sebep. Artık servis mesajı;
  // genel (bağlantı) mesajı yalnız sunucuya hiç ulaşılamadığında.
  it('sunucu arızasında servis mesajı, ulaşılamadığında genel hata verir', () => {
    expect(aiHataMetni({ error: 'upstream' }, t)).toBe('ai.errServis');
    expect(aiHataMetni({ error: 'bilinmeyen_kod' }, t)).toBe('ai.errTamamlanamadi');
    expect(aiHataMetni({}, t)).toBe('ai.errGeneric');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// İÇTİHAT EKRANININ HATA EŞLEMESİ
//
// Bu eşleme daha önce ekranda ÜÇ ayrı yerde elle yazılıydı; yeni bir hata türü
// eklendiğinde biri hep geride kalır ve kullanıcı hiçbir uyarı olmadan yanlış
// cümleyi görürdü. Tek kaynağa alındı ve buraya bağlandı.
describe('ictihatHataAnahtari', () => {
  it('bilinen her türü kendi cümlesine götürür', () => {
    expect(ictihatHataAnahtari('ai_off')).toBe('ictihat.errAiOff');
    expect(ictihatHataAnahtari('rate_limit')).toBe('ictihat.errRate');
    expect(ictihatHataAnahtari('source')).toBe('ictihat.errSource');
    expect(ictihatHataAnahtari('generic')).toBe('ictihat.errGeneric');
  });

  it('KVKK mesajlarını ai-chat ile ORTAK anahtara bağlar', () => {
    // Aynı sebeple kapanan iki ekran iki farklı cümle söyleseydi, kullanıcı
    // iki ayrı sorun olduğunu sanırdı.
    expect(ictihatHataAnahtari('kvkk')).toBe('ai.errKvkkRiza');
    expect(ictihatHataAnahtari('kvkk_arizasi')).toBe('ai.errKvkkKontrol');
  });

  it('rıza eksikliğiyle kontrol arızasını ayrı tutar', () => {
    expect(ictihatHataAnahtari('kvkk')).not.toBe(ictihatHataAnahtari('kvkk_arizasi'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// İÇTİHAT UCU HATA KODU → TÜR (09.10.2026)
//
// useIctihat'taki eşleme yalnız altı kodu tanıyordu. Yapay zekâ yolunun kota
// kodları (quota_exceeded, gunluk_hak_bitti, ai_soru_kota_bitti,
// deneme_hakki_bitti) "İnternet bağlantınızı kontrol edin"e düşüyordu: kotası
// biten avukat interneti suçluyordu. Eşleme saf modüle alındı (useIctihat
// supabase istemcisini çektiği için test ortamında yüklenemiyor).
describe('ictihatHataTuru', () => {
  const metin = (kod: string) => ictihatHataAnahtari(ictihatHataTuru(kod));

  it('yayındaki eski kodlar aynı türe gider', () => {
    expect(ictihatHataTuru('rate_limit')).toBe('rate_limit');
    expect(ictihatHataTuru('source_unreachable')).toBe('source');
    expect(ictihatHataTuru('not_configured')).toBe('ai_off');
    expect(ictihatHataTuru('tier_required')).toBe('paket');
    expect(ictihatHataTuru('kvkk_riza_yok')).toBe('kvkk');
    expect(ictihatHataTuru('kvkk_kontrol_hatasi')).toBe('kvkk_arizasi');
    expect(ictihatHataTuru('')).toBe('generic');
    expect(ictihatHataTuru('bilinmeyen')).toBe('generic');
  });

  it('kota kodları kendi (ai-chat ile ORTAK) cümlesine gider, internete değil', () => {
    expect(metin('quota_exceeded')).toBe('ai.errQuota');
    expect(metin('gunluk_hak_bitti')).toBe('ai.errDailyCap');
    expect(metin('ai_soru_kota_bitti')).toBe('ai.errSoruKota');
    expect(metin('deneme_hakki_bitti')).toBe('ai.errDenemeBitti');
  });

  it('yapay zekâ arızası UYAP arızası diye gösterilmez', () => {
    expect(metin('upstream')).toBe('ai.errServis');
    expect(metin('empty')).toBe('ai.errBos');
    expect(metin('unauthorized')).toBe('ai.errOturum');
  });

  it('olay analizinde karar bulunamaması ayrı ve iki dilde de var', () => {
    expect(metin('karar_yok')).toBe('ictihat.analyzeKararYok');
    expect(tr['ictihat.analyzeKararYok']).toBeTruthy();
    expect(en['ictihat.analyzeKararYok']).toBeTruthy();
  });
});

describe('içtihat ekranı hata metnini tek yerden alır', () => {
  it('belge ve özet pencereleri kendi üçlü koşulunu yazmıyor', () => {
    // Özet penceresi KVKK/paket/kota hatalarında bile "İnternet bağlantınızı
    // kontrol edin" diyordu: kendi rate_limit/source/generic koşulu vardı.
    const ekran = readFileSync(join(__dirname, '..', 'app/ictihat.tsx'), 'utf8');
    expect(ekran).not.toMatch(/error === 'source' \? t\('ictihat\.errSource'\)/);
    expect(ekran).not.toMatch(/error === 'rate_limit' \? t\('ictihat\.errRate'\)/);
  });
});
