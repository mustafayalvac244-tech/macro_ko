import { describe, expect, it } from 'vitest';
import { belgeOkumaHatasi, gelecekDurusmaGunu, yerelKunye } from '@/lib/iceAktarKunye';

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

// 08.10.2026: denetçinin çıkarıcıyı gerçek koşturarak bulduğu girdiler.
describe('yerel künye — denetimde bulunan hatalı çıkarımlar', () => {
  it('"MAHKEMESİ : ANKARA 3. ASLİYE HUKUK MAHKEMESİ" → mahkeme adı, etiket değil', () => {
    const k = yerelKunye('MAHKEMESİ : ANKARA 3. ASLİYE HUKUK MAHKEMESİ\nESAS NO : 2022/100');
    expect(k.form.court_name).toBe('ANKARA 3. ASLİYE HUKUK MAHKEMESİ');
  });

  it('"Esas No: 2023/145 Ankara 3. Asliye Hukuk Mahkemesi" tek satırda', () => {
    const k = yerelKunye('Esas No: 2023/145 Ankara 3. Asliye Hukuk Mahkemesi');
    expect(k.form.court_name).toBe('Ankara 3. Asliye Hukuk Mahkemesi');
    expect(k.form.case_number).toBe('2023/145');
  });

  it('yalnız "MAHKEMESİ" varsa mahkeme bulunmuş sayılmaz, yapay zekâya gidilir', () => {
    const k = yerelKunye('MAHKEMESİ\nESAS NO : 2022/100');
    expect(k.form.court_name).toBe('');
    expect(k.yeterli).toBe(false);
  });

  it('taraf satırındaki "Vergi Dairesi" mahkeme sanılmaz', () => {
    const k = yerelKunye('DAVALI : Çankaya Vergi Dairesi\nANKARA 2. VERGİ MAHKEMESİ');
    expect(k.form.court_name).toBe('ANKARA 2. VERGİ MAHKEMESİ');
  });

  it('BAM dairesi adın parçası olarak kalır', () => {
    const k = yerelKunye('İSTANBUL BÖLGE ADLİYE MAHKEMESİ 14. HUKUK DAİRESİ');
    expect(k.form.court_name).toBe('İSTANBUL BÖLGE ADLİYE MAHKEMESİ 14. HUKUK DAİRESİ');
  });

  it('7 haneli sıra numarası kesilmez (yanlış numara yerine boş)', () => {
    expect(yerelKunye('Esas No: 2023/1234567').form.case_number).toBe('');
  });

  it('taraf adında TC numarası kalmaz; "T.C. Ziraat Bankası" silinmez', () => {
    const k = yerelKunye('DAVACI : AHMET YILMAZ (TC: 12345678901)\nDAVALI : T.C. Ziraat Bankası A.Ş.');
    expect(k.taraflar.davaci).toBe('AHMET YILMAZ');
    expect(k.taraflar.davali).toBe('T.C. Ziraat Bankası A.Ş.');
  });

  it('boş etiket sonraki satırı değer saymaz', () => {
    const k = yerelKunye('Dava Türü :\nESAS NO : 2023/145\nDAVACI :\nDAVALI : Ahmet');
    expect(k.form.case_type).toBe('');
    expect(k.taraflar.davaci).toBe('');
    expect(k.form.case_number).toBe('2023/145');
  });

  it('geçmiş ve geçersiz duruşma tarihi alınmaz; sonraki duruşma önceliklidir', () => {
    expect(gelecekDurusmaGunu('2026-02-31', new Date(2026, 0, 1))).toBe('');
    expect(gelecekDurusmaGunu('2024-05-10', new Date(2026, 9, 8))).toBe('');
    expect(gelecekDurusmaGunu('2026-12-01', new Date(2026, 9, 8))).toBe('2026-12-01');
    const k = yerelKunye('Duruşma Tarihi: 10.05.2024\nSonraki Duruşma: 20.09.2099');
    expect(k.form.hearing_date).toBe('2099-09-20');
  });
});
