import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BELGE_KATEGORILERI,
  belgeLimitHatasi,
  belgeSahibiEtiketi,
  depoDosyaAdi,
  dosyaBoyutuAsildi,
  gercekDosyaBoyutu,
  ucretsizBelgeLimitiDolu,
} from '@/utils/belgeArsivi';
import { planLimitiCoz, UCRETSIZ_LIMIT } from '@/config/planlar';
import { tr } from '@/i18n/tr';
import { en } from '@/i18n/en';

/**
 * BELGE ARŞİVİ — saf mantık (10.10.2026 denetimi, 19. alan).
 * Ekranlar react-native çeker, burada koşmaz; kararlar bu modülde.
 */

describe('kategori süzgeci tüm kategorileri içerir', () => {
  it('veritabanı türündeki her kategori süzgeçte var (client_photo eksikti)', () => {
    const tumu = ['pleading', 'contract', 'evidence', 'correspondence', 'court_order', 'invoice', 'identification', 'client_photo', 'other'];
    expect([...BELGE_KATEGORILERI].sort()).toEqual([...tumu].sort());
  });

  it('her kategorinin çevirisi hem tr hem en içinde var', () => {
    for (const k of BELGE_KATEGORILERI) {
      expect(`docCategory.${k}` in tr).toBe(true);
      expect(`docCategory.${k}` in en).toBe(true);
    }
  });
});

describe('belge sahibi etiketi', () => {
  it('davaya bağlı belge dava başlığını gösterir', () => {
    expect(belgeSahibiEtiketi({ case: { title: 'Yılmaz / Demir' }, client: null })).toEqual({ tur: 'dava', ad: 'Yılmaz / Demir' });
  });

  it('müvekkile bağlı belge müvekkil adını gösterir (eskiden "Belgelerim" yazıyordu)', () => {
    expect(belgeSahibiEtiketi({ case: null, client: { full_name: 'Ayşe Kaya' } })).toEqual({ tur: 'muvekkil', ad: 'Ayşe Kaya' });
  });

  it('hiçbirine bağlı değilse "yok"', () => {
    expect(belgeSahibiEtiketi({ case: null, client: null })).toEqual({ tur: 'yok', ad: null });
    expect(belgeSahibiEtiketi({})).toEqual({ tur: 'yok', ad: null });
  });

  it('hem dava hem müvekkil varsa dava önde', () => {
    expect(belgeSahibiEtiketi({ case: { title: 'D' }, client: { full_name: 'M' } }).tur).toBe('dava');
  });
});

describe('depoda dosya adı', () => {
  it('Türkçe harfler okunur kalır, "_" olmaz', () => {
    expect(depoDosyaAdi('Vekâletname İçtihat Şikâyet ığüöç.pdf')).toBe('Vekaletname_Ictihat_Sikayet_iguoc.pdf');
  });

  it('uzantı korunur, geçersiz karakter "_" olur', () => {
    expect(depoDosyaAdi('a/b:c?.docx')).toBe('a_b_c_.docx');
  });

  it('tamamen Türkçe olmayan karakterlerde bile boş dönmez', () => {
    expect(depoDosyaAdi('日本語.pdf').endsWith('.pdf')).toBe(true);
    expect(depoDosyaAdi('日本語.pdf').length).toBeGreaterThan(4);
  });
});

describe('dosya boyutu bayttan doğrulanır', () => {
  it('seçici boyut bildirmediyse (0) okunan bayt sayısı kullanılır', () => {
    expect(gercekDosyaBoyutu(0, 30_000_000)).toBe(30_000_000);
  });

  it('bildirilen boyut varsa okunan bayt sayısı üstün gelir (yalan söyleyebilir)', () => {
    expect(gercekDosyaBoyutu(10, 30_000_000)).toBe(30_000_000);
  });

  it('okunan boş ise bildirilen kullanılır', () => {
    expect(gercekDosyaBoyutu(1234, 0)).toBe(1234);
  });

  it('25 MB üstü aşılmış sayılır, tam sınır aşılmış sayılmaz', () => {
    const MAX = 26_214_400;
    expect(dosyaBoyutuAsildi(MAX, MAX)).toBe(false);
    expect(dosyaBoyutuAsildi(MAX + 1, MAX)).toBe(true);
    expect(dosyaBoyutuAsildi(0, MAX)).toBe(false);
  });
});

describe('belge plan limiti ön kontrolü', () => {
  const ucretsiz = { is_premium: false, ai_tier: 'free' };
  const sinir = UCRETSIZ_LIMIT.belge;

  it('ücretsiz planda sınıra ulaşılmışsa dolu', () => {
    expect(ucretsizBelgeLimitiDolu(ucretsiz, sinir)).toBe(true);
    expect(ucretsizBelgeLimitiDolu(ucretsiz, sinir + 3)).toBe(true);
  });

  it('sınırın altındaysa dolu değil', () => {
    expect(ucretsizBelgeLimitiDolu(ucretsiz, sinir - 1)).toBe(false);
    expect(ucretsizBelgeLimitiDolu(ucretsiz, 0)).toBe(false);
  });

  it('Pro ve AI aboneleri sınırsız (sunucu kuralının aynısı)', () => {
    expect(ucretsizBelgeLimitiDolu({ is_premium: true, ai_tier: 'free' }, 99)).toBe(false);
    expect(ucretsizBelgeLimitiDolu({ is_premium: false, ai_tier: 'ai' }, 99)).toBe(false);
  });

  it('profil ya da sayı bilinmiyorsa ENGELLEMEZ — son sözü sunucu söyler', () => {
    expect(ucretsizBelgeLimitiDolu(null, sinir)).toBe(false);
    expect(ucretsizBelgeLimitiDolu(undefined, sinir)).toBe(false);
    expect(ucretsizBelgeLimitiDolu(ucretsiz, undefined)).toBe(false);
  });

  it('ön kontrolün hata kodu sunucununkiyle aynı biçimde ayrışır', () => {
    expect(planLimitiCoz(belgeLimitHatasi().message)).toEqual({ tur: 'belge', limit: sinir });
  });
});

describe('ekranlar bu kararları kullanır (kaynak taraması)', () => {
  const oku = (...p: string[]) => readFileSync(join(__dirname, '..', ...p), 'utf8');

  it('belge arşivi süzgeci yerel liste değil BELGE_KATEGORILERI kullanır', () => {
    const kaynak = oku('app', '(app)', 'documents', 'index.tsx');
    expect(kaynak).toContain('BELGE_KATEGORILERI');
    expect(kaynak).not.toContain("'identification'");
  });

  it('belge arşivi yükleme hatasını (isError) ele alır', () => {
    expect(oku('app', '(app)', 'documents', 'index.tsx')).toMatch(/isError/);
  });

  it('görüntüleyici Google gview kullanmaz ve web PDF için blob adresi kurar', () => {
    const kaynak = oku('app', 'document-viewer.tsx');
    expect(kaynak).not.toMatch(/https?:\/\/(docs|drive)\.google\.com/);
    expect(kaynak).toContain('createObjectURL');
  });

  it('yeni i18n anahtarları iki dilde var', () => {
    for (const k of ['docs.loadError', 'docs.clientOwner'] as const) {
      expect(k in tr).toBe(true);
      expect(k in en).toBe(true);
    }
  });
});
