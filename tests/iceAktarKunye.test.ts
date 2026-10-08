import { describe, expect, it } from 'vitest';
import { belgeOkumaHatasi, yerelKunye } from '@/lib/iceAktarKunye';

// Gerçekçi ama UYDURMA bir UYAP dosya üst bilgisi.
const UYAP = [
  'T.C.',
  'ANKARA 3. ASLİYE HUKUK MAHKEMESİ',
  'Esas No: 2023/145',
  'DAVACI : Örnek Davacı',
  'DAVALI : Örnek Davalı Ltd. Şti.',
  'Dava Türü: Alacak',
  'Duruşma Tarihi: 14.11.2026',
].join('\n');

describe('Belgeden dosya aç — önce yapay zekâsız', () => {
  it('esas no + mahkeme bulunursa yeterli: yapay zekâya gerek yok', () => {
    const y = yerelKunye(UYAP);
    expect(y.yeterli).toBe(true);
    expect(y.form.case_number).toBe('2023/145');
    expect(y.form.court_name).toMatch(/ASLİYE HUKUK MAHKEMESİ/);
    expect(y.form.hearing_date).toBe('2026-11-14');
  });

  it('karşı taraf TAHMİN EDİLMEZ; davacı/davalı seçenek olarak gelir', () => {
    const y = yerelKunye(UYAP);
    expect(y.form.opposing_party).toBe('');
    expect(y.taraflar.davaci).toMatch(/Örnek Davacı/);
    expect(y.taraflar.davali).toMatch(/Örnek Davalı/);
  });

  it('yalnız esas no varsa yeterli DEĞİL ama boş da değil', () => {
    const y = yerelKunye('Dilekçe ekidir. Esas No: 2024/88');
    expect(y.yeterli).toBe(false);
    expect(y.bosDegil).toBe(true);
  });

  it('ilgisiz metinde hiçbir alan uydurmaz', () => {
    const y = yerelKunye('Bugün hava çok güzel.');
    expect(y.bosDegil).toBe(false);
    expect(Object.values(y.form).every((v) => v === '')).toBe(true);
  });
});

describe('belge okuma hatası gerçek sebebi söyler', () => {
  it('taranmış PDF, büyük dosya, eski .doc ayrı mesaj alır; ".txt seçin" yok', () => {
    expect(belgeOkumaHatasi('pdf_no_text')).toBe('imp.hataTaranmis');
    expect(belgeOkumaHatasi('too_large')).toBe('ek.hata.buyuk');
    expect(belgeOkumaHatasi('doc_legacy')).toBe('ek.hata.eskiDoc');
    expect(belgeOkumaHatasi('bilinmeyen')).toBe('ek.hata.okunamadi');
  });
});
