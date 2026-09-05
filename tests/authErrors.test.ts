import { describe, expect, it } from 'vitest';
import { trError } from '@/lib/authErrors';

describe('trError', () => {
  it('bilinen Supabase hatalarını Türkçeye çevirir', () => {
    expect(trError('Invalid login credentials')).toBe('E-posta veya şifre hatalı.');
    expect(trError('Email not confirmed')).toBe(
      'E-posta adresiniz henüz doğrulanmamış. Gelen kutunuzu kontrol edin.'
    );
    expect(trError('User already registered')).toBe(
      'Bu e-posta ile zaten bir hesap var. Giriş yapmayı deneyin.'
    );
  });

  it('ağ hatalarını tek mesajda toplar (uygulama YAPILANDIRILMIŞKEN)', () => {
    const beklenen = 'İnternet bağlantısı kurulamadı. Bağlantınızı kontrol edip tekrar deneyin.';
    expect(trError('Network request failed', true)).toBe(beklenen);
    expect(trError('TypeError: Failed to fetch', true)).toBe(beklenen);
    expect(trError('fetch failed', true)).toBe(beklenen);
  });

  it('yapılandırma eksikse ağ hatasını bağlantı sorunu sanmaz', () => {
    // Web derlemesi .env olmadan üretildiğinde her istek ağ hatası verir ve
    // kullanıcı bağlantısını kontrol edip durur; sebep yapılandırmadır.
    const cfg = trError('Network request failed', false);
    expect(cfg).toContain('.env');
    expect(cfg).not.toContain('Bağlantınızı kontrol');
  });

  it('yapılandırma eksik olsa da ağ DIŞI hatalar aynı çevrilir', () => {
    expect(trError('Invalid login credentials', false)).toBe('E-posta veya şifre hatalı.');
  });

  it('yetki hatasını kullanıcı diline çevirir (RLS sızdırmaz)', () => {
    expect(trError('new row violates row-level security policy')).toBe(
      'Bu işlem için yetkiniz yok.'
    );
    expect(trError('permission denied for table cases')).toBe('Bu işlem için yetkiniz yok.');
  });

  it('boş/eksik mesajda genel hata döner', () => {
    expect(trError(null)).toBe('Bir hata oluştu. Lütfen tekrar deneyin.');
    expect(trError(undefined)).toBe('Bir hata oluştu. Lütfen tekrar deneyin.');
    expect(trError('')).toBe('Bir hata oluştu. Lütfen tekrar deneyin.');
  });

  it('tanımadığı mesajı olduğu gibi bırakır', () => {
    // Kendi fırlattığımız Türkçe hatalar bozulmamalı.
    expect(trError('Dosya numarası zaten kayıtlı.')).toBe('Dosya numarası zaten kayıtlı.');
  });

  it('büyük/küçük harf farkı gözetmez', () => {
    expect(trError('INVALID LOGIN CREDENTIALS')).toBe('E-posta veya şifre hatalı.');
  });
});
