import { describe, expect, it } from 'vitest';
import { LEGAL_DEADLINES } from '@/constants/legalDeadlines';

/**
 * SÜRE KATALOĞU KİLİDİ.
 *
 * Aşağıdaki değerlerin her biri, kanunun KENDİ METNİ okunarak doğrulandı
 * (mevzuat havuzumuzdaki resmî metinler; İİK, İYUK ve 6216 s. Kanun bu iş için
 * havuza eklendi — önce metinleri yoktu ve bu süreler hiç doğrulanamıyordu).
 * Doğrulamada bulunan lafızlar yorumda tek tek yazılıdır.
 *
 * Bu test bir hesaplama sınamıyor; KATALOĞU KİLİTLİYOR. Yanlış süre avukat
 * için meslekî sorumluluktur ve tek karakterlik bir düzenlemeyle sessizce
 * bozulabilir; burada patlar.
 */
const DOGRULANMIS: Record<string, [number, string]> = {
  // HMK m.127: "...tebliğinden itibaren iki haftadır"
  cevap: [2, 'week'],
  // HMK m.136: "...iki hafta içinde cevaba cevap dilekçesi"
  'ikinci-dilekce': [2, 'week'],
  // HMK m.345: "İstinaf yoluna başvuru süresi iki haftadır"
  'istinaf-hukuk': [2, 'week'],
  // HMK m.347/2: "...tebliğden itibaren iki hafta içinde cevap dilekçesini"
  'istinaf-cevap': [2, 'week'],
  // HMK m.361: "...tebliğ tarihinden itibaren iki hafta içinde temyiz"
  'temyiz-hukuk': [2, 'week'],
  // HMK m.281: "...tebliği tarihinden itibaren iki hafta içinde"
  'bilirkisi-itiraz': [2, 'week'],
  // HMK m.394: "...tutanağın tebliğinden itibaren bir hafta içinde"
  'tedbir-itiraz': [1, 'week'],

  // CMK m.273: "...tebliğ edildiği tarihten itibaren iki hafta içinde"
  'istinaf-ceza': [2, 'week'],
  // CMK m.291: "...tebliğ edildiği tarihten itibaren iki hafta içinde"
  'temyiz-ceza': [2, 'week'],
  // CMK m.268: "...kararı öğrendiği günden itibaren iki hafta içinde"
  'cmk-itiraz': [2, 'week'],
  // CMK m.173: "...tebliğ edildiği tarihten itibaren iki hafta içinde"
  'kyok-itiraz': [2, 'week'],

  // İİK m.62: "...ödeme emrinin tebliği tarihinden itibaren yedi gün içinde"
  'odeme-emri-itiraz': [7, 'day'],
  // İİK m.168: "...beş gün içinde icra mahkemesine" (borca/imzaya itiraz)
  'kambiyo-itiraz': [5, 'day'],
  // İİK m.16: "Şikayet bu muamelelerin öğrenildiği tarihten yedi gün içinde"
  'icra-sikayet': [7, 'day'],
  // İİK m.134: "...ihale tarihinden itibaren yedi gün içinde"
  'ihale-feshi': [7, 'day'],
  // İİK m.67: "...itirazın tebliği tarihinden itibaren bir sene içinde"
  'itirazin-iptali': [1, 'year'],

  // İYUK m.7: "...Danıştayda ve idare mahkemelerinde altmış ve vergi
  // mahkemelerinde otuz gündür"
  'idari-dava': [60, 'day'],
  'vergi-dava': [30, 'day'],
  // İYUK m.45: "...kararın tebliğinden itibaren otuz gün içinde istinaf"
  'idari-istinaf': [30, 'day'],
  // İYUK m.46: "...kararın tebliğinden itibaren otuz gün içinde temyiz"
  'idari-temyiz': [30, 'day'],
  // 6216 s.K. m.47: "...ihlalin öğrenildiği tarihten itibaren otuz gün içinde"
  'aym-basvuru': [30, 'day'],

  // İş K. m.20: "...tebliği tarihinden itibaren bir ay içinde ... arabulucuya"
  'ise-iade': [1, 'month'],
  // İş K. m.20: "...son tutanağın düzenlendiği tarihten itibaren, iki hafta içinde"
  'arabuluculuk-dava': [2, 'week'],
};

describe('süre kataloğu — kanun metniyle doğrulanmış değerler', () => {
  it('her süre doğrulanmış değeriyle aynı', () => {
    for (const def of LEGAL_DEADLINES) {
      const beklenen = DOGRULANMIS[def.id];
      expect(beklenen, `${def.id} için doğrulanmış değer yok`).toBeDefined();
      expect([def.amount, def.unit], `${def.id} (${def.basis})`).toEqual(beklenen);
    }
  });

  it('katalog dışında doğrulanmış kayıt kalmamış', () => {
    const idler = new Set(LEGAL_DEADLINES.map((d) => d.id));
    for (const id of Object.keys(DOGRULANMIS)) {
      expect(idler.has(id), `${id} katalogdan çıkarılmış`).toBe(true);
    }
  });

  it('her sürenin dayanağı yazılı ve grubu tanımlı', () => {
    for (const def of LEGAL_DEADLINES) {
      expect(def.basis.trim().length, def.id).toBeGreaterThan(3);
      expect(['hukuk', 'ceza', 'icra', 'idare', 'is']).toContain(def.group);
    }
  });
});
