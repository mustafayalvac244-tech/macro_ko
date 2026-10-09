import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as authErrors from '@/lib/authErrors';
import { useLangStore } from '@/i18n';

/**
 * GİRİŞ HATALARI ARAYÜZ DİLİNDE (09.10.2026 denetimi).
 *
 * trError her zaman Türkçe döndürüyordu: Ayarlar'dan İngilizce seçen avukat
 * çıkış yapıp yanlış şifre girince İngilizce ekranda Türkçe hata görüyordu.
 * Aynı şey şifre sıfırlama ve şifre değiştirme ekranlarında da geçerliydi.
 */
const { trError } = authErrors;
type Dil = 'tr' | 'en';
const cevir = trError as unknown as (m: string | null | undefined, y?: boolean, dil?: Dil) => string;

// Supabase/GoTrue'nun ve ağ katmanının gerçek metinleri (her desen için bir örnek).
const ORNEKLER = [
  'Invalid login credentials',
  'zaten-kayitli',
  'email rate limit exceeded',
  'For security purposes, you can only request this after 17 seconds.',
  'User already registered',
  'Password should be at least 8 characters.',
  'Password should contain at least one character of each: abc, 123',
  'Unable to validate email address: invalid format',
  'Email not confirmed',
  'New password should be different from the old password.',
  'Token has expired or is invalid',
  'invalid otp',
  'User not found',
  'Signups not allowed for this instance',
  'Too many requests',
  'Gateway Timeout',
  'Network request failed',
  'JWT expired',
  'Payload too large',
  'new row violates row-level security policy',
  'duplicate key value violates unique constraint',
];

describe('trError arayüz diliyle konuşur', () => {
  it('İngilizce arayüzde yanlış şifre İngilizce söylenir', () => {
    const en = cevir('Invalid login credentials', true, 'en');
    expect(en).toMatch(/password/i);
    expect(en).not.toMatch(/şifre|hatalı/i);
  });

  it('her desenin İngilizce karşılığı var ve Türkçesinden farklı', () => {
    for (const m of ORNEKLER) {
      const tr = cevir(m, true, 'tr');
      const en = cevir(m, true, 'en');
      expect(tr, m).not.toBe(m); // desen gerçekten eşleşiyor
      expect(en, m).not.toBe(tr);
      expect(en, m).not.toMatch(/[ğüşıöçĞÜŞİÖÇ]/);
    }
  });

  it('yapılandırma eksikliği, boş mesaj ve ham JSON da çevrilir', () => {
    expect(cevir('Network request failed', false, 'en')).toMatch(/\.env/);
    expect(cevir('', true, 'en')).not.toBe(cevir('', true, 'tr'));
    expect(cevir('{"code":"x"}', true, 'en')).not.toMatch(/[{ğüşı]/);
  });

  it('dil verilmezse uygulamanın seçili dili kullanılır', () => {
    const once = useLangStore.getState().lang;
    try {
      useLangStore.setState({ lang: 'en' });
      expect(trError('Invalid login credentials')).toMatch(/password/i);
      expect(trError('Invalid login credentials')).not.toMatch(/şifre/i);
      useLangStore.setState({ lang: 'tr' });
      expect(trError('Invalid login credentials')).toMatch(/E-posta veya şifre hatalı/);
    } finally {
      useLangStore.setState({ lang: once });
    }
  });

  it('"doğrulanmamış" tanıması iki dilde de çalışır (tekrar gönder düğmesi buna bağlı)', () => {
    const tani = (authErrors as unknown as { dogrulanmamisMi?: (m: string | null) => boolean }).dogrulanmamisMi;
    expect(typeof tani).toBe('function');
    expect(tani!(cevir('Email not confirmed', true, 'tr'))).toBe(true);
    expect(tani!(cevir('Email not confirmed', true, 'en'))).toBe(true);
    expect(tani!(cevir('Invalid login credentials', true, 'en'))).toBe(false);
    expect(tani!(null)).toBe(false);
  });

  it('giriş ekranı Türkçe sabitle karşılaştırmıyor', () => {
    const giris = readFileSync(join(__dirname, '..', 'app', '(auth)', 'login.tsx'), 'utf8');
    expect(giris).not.toMatch(/===\s*DOGRULANMAMIS\b/);
    expect(giris).toMatch(/dogrulanmamisMi\(error\)/);
  });
});
