import { describe, expect, it } from 'vitest';

import { calisanPaketMetni } from '../arac-audit-app/src/cekirdek/surum';

// OTA (28.09.2026, ürün sahibi: "OTA ile güncelleme at"). Ayarlar → Sürüm
// satırı, bir güncellemenin telefona gerçekten İNDİĞİNİ görmenin tek yolu:
// iş akışı yalnız "yayımlandı" diyebilir.

// Yerel saat bileşenleriyle kurulur: sınama hangi saat diliminde koşarsa
// koşsun ekrandaki "07:40" aynı çıkmalı.
const TARIH = new Date(2026, 8, 28, 7, 40);
const KIMLIK = '1a2b3c4d-0000-4000-8000-000000000000';

describe('çalışan paket metni', () => {
  it('APK ile gelen paketin de kimliği var; yine "APK ile gelen" yazar', () => {
    expect(calisanPaketMetni({ isEmbeddedLaunch: true, updateId: KIMLIK, createdAt: TARIH }))
      .toBe('APK ile gelen paket · 28.09.2026 07:40');
  });

  it('OTA ile inen paket: kimliğin ilk 8 hanesi ve tarih', () => {
    expect(calisanPaketMetni({ isEmbeddedLaunch: false, updateId: KIMLIK, createdAt: TARIH }))
      .toBe('Güncelleme 1a2b3c4d · 28.09.2026 07:40');
  });

  it('tarih yoksa ya da geçersizse yalnız ad yazılır, "Invalid Date" yazılmaz', () => {
    expect(calisanPaketMetni({ isEmbeddedLaunch: false, updateId: KIMLIK, createdAt: null }))
      .toBe('Güncelleme 1a2b3c4d');
    expect(calisanPaketMetni({ isEmbeddedLaunch: false, updateId: KIMLIK, createdAt: new Date('bozuk') }))
      .toBe('Güncelleme 1a2b3c4d');
  });

  it('kimlik yoksa APK ile gelen sayılır', () => {
    expect(calisanPaketMetni({ isEmbeddedLaunch: false })).toBe('APK ile gelen paket');
  });
});
