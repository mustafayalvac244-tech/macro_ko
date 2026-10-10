import { beforeEach, describe, expect, it } from 'vitest';
import {
  bekciKarari,
  girisHedefi,
  girisHedefiniBirak,
  girisHedefiniSakla,
  girisHedefiVarMi,
  girisHedefiYolu,
  herkeseAcikMi,
} from '../src/lib/girisYonlendirme';

/**
 * Oturumsuz derin bağlantı, girişten sonra hedefe dönüş, çıkışta yığın
 * (AJAN 28, bulgu 5/6/8). Karar mantığı saf: expo-router'dan bağımsız.
 */
describe('herkeseAcikMi', () => {
  it('giriş, KVKK/gizlilik/şartlar, şifre sıfırlama ve bulunamadı oturumsuz açılabilir', () => {
    for (const s of ['(auth)', 'forgot-password', 'privacy', 'terms', 'kvkk', '+not-found']) {
      expect(herkeseAcikMi([s])).toBe(true);
    }
    expect(herkeseAcikMi([])).toBe(true); // kök dizin (index yönlendirmesi)
  });
  it('kök seviyedeki iç ekranlar herkese açık DEĞİL', () => {
    for (const s of ['ai-chat', 'case-form', 'settings', 'finance', 'law', 'admin', 'document-viewer']) {
      expect(herkeseAcikMi([s])).toBe(false);
    }
  });
});

describe('bekciKarari', () => {
  const taban = { baslatiliyor: false, oturumVar: false, oturumGoruldu: false, segmentler: ['ai-chat'] };

  it('oturum henüz okunmadıysa karar verme (derin bağlantı kaybolmasın)', () => {
    expect(bekciKarari({ ...taban, baslatiliyor: true })).toBe('yok');
  });
  it('oturumsuz kök ekran → girişe at', () => {
    expect(bekciKarari(taban)).toBe('girise-at');
  });
  it('oturumsuz herkese açık ekran → dokunma', () => {
    expect(bekciKarari({ ...taban, segmentler: ['privacy'] })).toBe('yok');
    expect(bekciKarari({ ...taban, segmentler: ['(auth)', 'login'] })).toBe('yok');
  });
  it('(app) grubunun kendi bekçisi var → çift yönlendirme yok', () => {
    expect(bekciKarari({ ...taban, segmentler: ['(app)', 'cases'] })).toBe('yok');
  });
  it('oturum VARDI ve şimdi yok → çıkış: yığını temizle', () => {
    expect(bekciKarari({ ...taban, oturumGoruldu: true })).toBe('cikis');
    expect(bekciKarari({ ...taban, oturumGoruldu: true, segmentler: ['(app)', 'cases'] })).toBe('cikis');
  });
  it('oturum varken uygulama içine varıldıysa bekleyen hedef bırakılır', () => {
    expect(bekciKarari({ ...taban, oturumVar: true, oturumGoruldu: true, segmentler: ['(app)', 'cases'] })).toBe('hedefi-birak');
    expect(bekciKarari({ ...taban, oturumVar: true, oturumGoruldu: true })).toBe('hedefi-birak');
  });
  it('oturum varken giriş/şifre-sıfırlama ekranındayken hedef KORUNUR (yönlendirme henüz olmadı)', () => {
    expect(bekciKarari({ ...taban, oturumVar: true, segmentler: ['(auth)', 'login'] })).toBe('yok');
    expect(bekciKarari({ ...taban, oturumVar: true, segmentler: ['forgot-password'] })).toBe('yok');
  });
});

describe('girişten sonra hedef', () => {
  beforeEach(() => girisHedefiniBirak());

  it('hedef yoksa ana ekran', () => {
    expect(girisHedefi()).toBe('/(app)');
    expect(girisHedefiVarMi()).toBe(false);
  });
  it('saklanan hedefe dönülür ve okuma onu SİLMEZ (girişin iki yolu aynı hedefi görsün)', () => {
    girisHedefiniSakla('/cases/abc');
    expect(girisHedefi()).toBe('/cases/abc');
    expect(girisHedefi()).toBe('/cases/abc');
    girisHedefiniBirak();
    expect(girisHedefi()).toBe('/(app)');
  });
  it('giriş/kök/dış adresler hedef OLAMAZ (döngü ve açık yönlendirme)', () => {
    for (const kotu of ['/', '', '/login', '/(auth)/login', '/signup', '//evil.example', 'https://evil.example', 'cases']) {
      girisHedefiniSakla(kotu);
      expect(girisHedefiVarMi()).toBe(false);
    }
  });
});

describe('girisHedefiYolu', () => {
  it('yol + sorgu', () => {
    expect(girisHedefiYolu('/case-form', { clientId: 'k1' })).toBe('/case-form?clientId=k1');
  });
  it('dinamik parça yolda zaten var → sorguya tekrar yazılmaz', () => {
    expect(girisHedefiYolu('/cases/abc', { id: 'abc' })).toBe('/cases/abc');
  });
  it('param yoksa yalnız yol; dizi değerler tekrarlanır', () => {
    expect(girisHedefiYolu('/search')).toBe('/search');
    expect(girisHedefiYolu('/search', { q: ['a', 'b'], bos: undefined })).toBe('/search?q=a&q=b');
  });
});
