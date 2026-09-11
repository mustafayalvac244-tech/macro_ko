import { describe, expect, it } from 'vitest';
import { cihazAdiUret, isletimAdi, tarayiciAdi } from '@/utils/cihazAdi';

/**
 * CİHAZ ADI.
 *
 * Cihaz listesinin tek işe yarama koşulu, kullanıcının satıra bakıp "bu benim
 * telefonum" diyebilmesidir. Ad boş ya da anlamsız çıkarsa liste güvenlik
 * aracı olmaktan çıkar. expo-device alanları platforma göre eksik geldiği için
 * birleştirme kuralları burada sınanıyor.
 */

describe('tarayiciAdi', () => {
  it('Edge kendini Chrome olarak da tanıtır — önce Edge görülmeli', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120 Safari/537.36 Edg/120.0';
    expect(tarayiciAdi(ua)).toBe('Edge');
  });

  it('Opera kendini Chrome olarak da tanıtır', () => {
    expect(tarayiciAdi('... Chrome/120 Safari/537.36 OPR/106.0')).toBe('Opera');
  });

  it('Chrome kendini Safari olarak da tanıtır — Safari en sonda bakılır', () => {
    expect(tarayiciAdi('... AppleWebKit/537.36 Chrome/120 Safari/537.36')).toBe('Chrome');
  });

  it('gerçek Safari Safari döner', () => {
    expect(tarayiciAdi('Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15')).toBe('Safari');
  });

  it('iOS Chrome (CriOS) Chrome sayılır', () => {
    expect(tarayiciAdi('Mozilla/5.0 (iPhone) CriOS/120 Mobile/15E148 Safari/604.1')).toBe('Chrome');
  });

  it('boş/bilinmeyen ajanda boş döner', () => {
    expect(tarayiciAdi('')).toBe('');
    expect(tarayiciAdi(null)).toBe('');
    expect(tarayiciAdi('bilinmeyen-istemci/1.0')).toBe('');
  });
});

describe('isletimAdi', () => {
  it('iPhone "mac os x" da içerir — iOS önce bakılmalı', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)';
    expect(isletimAdi(ua)).toBe('iOS');
  });

  it('gerçek Mac macOS döner', () => {
    expect(isletimAdi('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('macOS');
  });

  it('Android, Windows, Linux', () => {
    expect(isletimAdi('Mozilla/5.0 (Linux; Android 14; SM-S911B)')).toBe('Android');
    expect(isletimAdi('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('Windows');
    expect(isletimAdi('Mozilla/5.0 (X11; Linux x86_64)')).toBe('Linux');
  });
});

describe('cihazAdiUret', () => {
  it('natifte marka + model birleşir', () => {
    expect(cihazAdiUret({ marka: 'Apple', model: 'iPhone 15 Pro', platform: 'ios' })).toBe('Apple iPhone 15 Pro');
  });

  it('marka model içinde geçiyorsa TEKRAR ETMEZ', () => {
    // "samsung" + "samsung SM-A515F" → "samsung SM-A515F"
    expect(cihazAdiUret({ marka: 'samsung', model: 'samsung SM-A515F', platform: 'android' })).toBe('samsung SM-A515F');
  });

  it('model yoksa markayla yetinir', () => {
    expect(cihazAdiUret({ marka: 'Xiaomi', model: null, platform: 'android' })).toBe('Xiaomi');
  });

  it('natifte hiçbir bilgi yoksa platform adına düşer — satır boş kalmaz', () => {
    expect(cihazAdiUret({ platform: 'android' })).toBe('Android');
    expect(cihazAdiUret({ platform: 'ios' })).toBe('iPhone/iPad');
  });

  it('web tarayıcı + işletim sistemi kullanır, marka/modeli DEĞİL', () => {
    expect(
      cihazAdiUret({ marka: 'Apple', model: 'Macintosh', platform: 'web', tarayici: 'Chrome', isletim: 'macOS' })
    ).toBe('Chrome macOS');
  });

  it('webde tarayıcı bilinmiyorsa da anlamlı bir ad döner', () => {
    expect(cihazAdiUret({ platform: 'web', tarayici: '', isletim: '' })).toBe('Tarayıcı');
  });

  it('platform bile bilinmiyorsa boş satır yerine bilinen bir metin', () => {
    expect(cihazAdiUret({})).toBe('Bilinmeyen cihaz');
  });
});
