import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * VEKTÖRLEME YIĞIN BOYUTU TEK YERDE KALMAK ZORUNDA DEĞİL — AMA UYUŞMAK ZORUNDA.
 *
 * GERÇEK ARIZA (18.09.2026, canlıda ölçüldü):
 * pg_cron her 3 dakikada `vektorle_tetikle('ictihat', 6)` çağırıyordu. Edge
 * işlevinin tavanı da 6'ydı, yani istek kırpılmadan geçiyordu — ve HER ÇAĞRI
 * 546 WORKER_RESOURCE_LIMIT ile düşüyordu. Üç saatteki 60 çağrının 60'ı da.
 *
 * Arıza görünmedi çünkü kayıtlar tek tek update ediliyor: çöküşten ÖNCE
 * yazılanlar kalıyordu. Dışarıdan "yavaş çalışıyor" gibi görünen şey aslında
 * %100 hataydı. Havuz saatte ~511 karar büyürken vektörleme ~68 yapıyordu.
 *
 * Bu test iki şeyi bağlar: edge işlevinin kabul ettiği tavan ile yerel
 * betiğin gönderebildiği tavan. İkisi ayrışırsa betik, uçta sessizce
 * kırpılan bir sayı gönderir ve kaç kayıt işlendiğini yanlış varsayar.
 *
 * NE YAPMAZ: 4'ün güvenli olduğunu KANITLAMAZ. Güvenli sınır canlıda ölçülür
 * ve değişebilir (model, çalışma zamanı, metin uzunluğu). Bu test yalnız
 * "iki yer aynı sayıyı biliyor mu" der.
 */

const KOK = new URL('..', import.meta.url).pathname;
const oku = (...yol: string[]) => readFileSync(join(KOK, ...yol), 'utf8');

const sayi = (metin: string, kalip: RegExp, ad: string): number => {
  const m = metin.match(kalip);
  expect(m, `${ad}: kalıp bulunamadı — dosya değişmiş olabilir, test güncellenmeli`).toBeTruthy();
  return Number(m![1]);
};

describe('vektörleme yığın boyutu', () => {
  it('edge işlevi ile yerel betik aynı tavanı biliyor', () => {
    const uc = oku('supabase', 'functions', 'embed-ictihat', 'index.ts');
    const betik = oku('scripts', 'embed-ictihat.mjs');

    const ucTavan = sayi(uc, /limit = Math\.min\((\d+),/, 'edge tavanı');
    const betikTavan = sayi(betik, /const BATCH = Math\.min\((\d+),/, 'betik tavanı');

    expect(
      betikTavan,
      `betik ${betikTavan} gönderebiliyor ama uç en fazla ${ucTavan} kabul ediyor — ` +
        'betik uçta sessizce kırpılır ve kaç kayıt işlendiğini yanlış sanar',
    ).toBeLessThanOrEqual(ucTavan);
  });

  it('ölçülen üst sınırın (6) altında kalınıyor', () => {
    // 6, canlıda HER SEFERİNDE WORKER_RESOURCE_LIMIT veren değer. Tavan
    // bir gün yeniden 6'ya çıkarılırsa aynı arıza sessizce geri gelir.
    const uc = oku('supabase', 'functions', 'embed-ictihat', 'index.ts');
    const ucTavan = sayi(uc, /limit = Math\.min\((\d+),/, 'edge tavanı');
    expect(
      ucTavan,
      '6 ve üstü canlıda %100 WORKER_RESOURCE_LIMIT veriyordu (18.09.2026 ölçümü)',
    ).toBeLessThan(6);
  });

  it('paralel işçiler için atlama parametresi duruyor', () => {
    // 8 cron işi aynı anda koşuyor; `atla` olmazsa hepsi AYNI satırları
    // seçer ve 8 kat boşa hesap yapılır.
    const uc = oku('supabase', 'functions', 'embed-ictihat', 'index.ts');
    expect(uc.includes('.range(atla'), 'edge işlevi atlama uygulamıyor').toBe(true);
    expect(/body\?\.atla/.test(uc), 'edge işlevi atla parametresini okumuyor').toBe(true);
  });
});
