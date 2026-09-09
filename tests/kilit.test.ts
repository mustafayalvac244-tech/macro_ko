import { describe, expect, it } from 'vitest';
import { kilitGerekliMi, KILIT_MUHLETI_MS } from '@/store/lockStore';

/**
 * UYGULAMA KİLİDİ — arka plandan dönüşte yeniden kilitlenme kararı.
 *
 * BULUNAN KUSUR: `lock()` fonksiyonunu hiçbir yer çağırmıyordu. Kilit yalnız
 * soğuk açılışta devreye giriyordu, yani uygulama bir kez açıldıktan sonra
 * işletim sistemi onu bellekten atana kadar bir daha kilitlenmiyordu. Masada
 * bırakılan bir telefonda müvekkil dosyaları açık kalıyordu.
 *
 * Mühlet kasıtlıdır ve keyfî değildir: uygulama belge/fotoğraf seçerken
 * KENDİSİ arka plana geçiyor. Mühletsiz kilit, avukatı her dosya eklemede
 * parmak izi ekranına düşürür ve kendi akışını kırardı.
 */

describe('kilitGerekliMi', () => {
  const simdi = 1_700_000_000_000;

  it('uygulama hiç arka plana geçmediyse kilitlemez', () => {
    expect(kilitGerekliMi(null, simdi)).toBe(false);
  });

  it('kısa bir arka plandan dönüşte kilitlemez (dosya seçici senaryosu)', () => {
    // Belge seçmek 10-20 saniye sürer; bu her seferinde parmak izi istememeli.
    expect(kilitGerekliMi(simdi - 15_000, simdi)).toBe(false);
  });

  it('mühlet sınırında kilitlemez, sınırın ÜSTÜNDE kilitler', () => {
    expect(kilitGerekliMi(simdi - KILIT_MUHLETI_MS, simdi)).toBe(false);
    expect(kilitGerekliMi(simdi - KILIT_MUHLETI_MS - 1, simdi)).toBe(true);
  });

  it('uzun süre arka planda kaldıysa kilitler (masada bırakılan telefon)', () => {
    expect(kilitGerekliMi(simdi - 30 * 60_000, simdi)).toBe(true);
    expect(kilitGerekliMi(simdi - 8 * 3600_000, simdi)).toBe(true);
  });

  it('mühlet dışarıdan verilebilir (davranış sabite gömülü değil)', () => {
    expect(kilitGerekliMi(simdi - 5_000, simdi, 1_000)).toBe(true);
    expect(kilitGerekliMi(simdi - 5_000, simdi, 60_000)).toBe(false);
  });

  it('mühlet, dosya seçmeye yetecek kadar uzun ama dakikalarca sürmemeli', () => {
    // Tel kapan: birisi mühleti 5 dakikaya çıkarırsa bu test sorar.
    expect(KILIT_MUHLETI_MS).toBeGreaterThanOrEqual(30_000);
    expect(KILIT_MUHLETI_MS).toBeLessThanOrEqual(120_000);
  });
});
