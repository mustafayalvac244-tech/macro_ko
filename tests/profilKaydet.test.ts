import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fotoSecimSonucu, profiliKaydet } from '../src/utils/profilKaydet';

// PROFİL DÜZENLEME (09.10.2026).
//
// 1) FOTOĞRAF HATASI "PROFİL KAYDEDİLEMEDİ" DİYORDU. Kaydet önce metin
//    alanlarını yazıyor, sonra fotoğrafı yüklüyordu; tek bir catch ikisini de
//    'profile.saveFailed' ile karşılıyordu. Metin aslında kaydedilmişken
//    kullanıcı her şeyin kaybolduğunu sanıyordu. 'profile.photoFailed'
//    anahtarı i18n'de vardı ama hiçbir yerde kullanılmıyordu.
// 2) İZİN REDDİ SESSİZDİ. pickImageFile/takePhotoFile izin verilmezse null
//    döner — vazgeçmeyle aynı; ekran hiçbir şey söylemiyordu. iOS izni bir
//    kez reddedilince sistem bir daha sormaz: düğme "bozuk" görünür.

describe('profiliKaydet', () => {
  it('fotoğraf yüklenemezse sonuç "foto-hatasi" (metin kaydı başarılı)', async () => {
    const sonuc = await profiliKaydet({
      metniKaydet: async () => {},
      fotoyuUygula: async () => {
        throw new Error('Payload too large');
      },
    });
    expect(sonuc).toBe('foto-hatasi');
  });

  it('metin kaydedilemezse "metin-hatasi" ve fotoğraf denenmez', async () => {
    let fotoDenendi = false;
    const sonuc = await profiliKaydet({
      metniKaydet: async () => {
        throw new Error('network request failed');
      },
      fotoyuUygula: async () => {
        fotoDenendi = true;
      },
    });
    expect(sonuc).toBe('metin-hatasi');
    expect(fotoDenendi).toBe(false);
  });

  it('ikisi de geçerse "tamam"; fotoğraf değişikliği yoksa yalnız metin', async () => {
    expect(await profiliKaydet({ metniKaydet: async () => {}, fotoyuUygula: async () => {} })).toBe('tamam');
    expect(await profiliKaydet({ metniKaydet: async () => {}, fotoyuUygula: null })).toBe('tamam');
  });
});

describe('fotoSecimSonucu', () => {
  it('dosya yok + izin yok → "izin-yok" (sessiz kalınmaz)', () => {
    expect(fotoSecimSonucu(false, false)).toBe('izin-yok');
  });

  it('dosya yok + izin var → kullanıcı vazgeçti, uyarı yok', () => {
    expect(fotoSecimSonucu(false, true)).toBe('vazgecildi');
  });

  it('izin okunamadıysa (null) uydurma uyarı verilmez', () => {
    expect(fotoSecimSonucu(false, null)).toBe('vazgecildi');
  });

  it('dosya geldiyse seçildi', () => {
    expect(fotoSecimSonucu(true, true)).toBe('secildi');
  });
});

describe('profil ekranı yardımcıları kullanıyor', () => {
  const ekran = readFileSync(join(__dirname, '..', 'app/profile-form.tsx'), 'utf8');

  it("fotoğraf hatası için 'profile.photoFailed' gösteriliyor", () => {
    expect(ekran).toContain('profiliKaydet(');
    expect(ekran).toMatch(/'foto-hatasi'\s*\?\s*'profile\.photoFailed'/);
  });

  it('izin reddi ekranda söyleniyor', () => {
    expect(ekran).toContain('fotoSecimSonucu(');
    expect(ekran).toContain("'profile.photoPermDenied'");
  });
});
