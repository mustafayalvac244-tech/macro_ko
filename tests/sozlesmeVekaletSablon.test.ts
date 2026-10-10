import { describe, expect, it } from 'vitest';
import { buildContract, muvekkilFormAlanlari, type ContractInput } from '@/utils/contractTemplate';
import { duzenlemeTarihi, durumGuncellemesi, musteriFiltrele } from '@/utils/vekaletForm';
import { PETITION_TEMPLATES } from '@/constants/petitionTemplates';

/**
 * AJAN 24 (10.10.2026) — sözleşme + vekâletname + dilekçe şablonları denetimi.
 *
 * Kanun atıfları 10.10.2026'da mevzuat.gov.tr'den (MevzuatFihristDetayIframe)
 * okunan metinle karşılaştırıldı:
 *  - Av.K. m.163: sözleşme "serbestçe düzenlenir", belli bir hukukî yardımı ve
 *    meblağı/değeri kapsamalı; yazılı olmayan anlaşmalar genel hükümlere göre
 *    İSPATLANIR (yazı geçerlilik şartı DEĞİL).
 *  - Av.K. m.174: azilde ücretin tamamı verilir, avukat kusur/ihmaliyle
 *    azledilmişse ödenmez; haklı sebep olmadan işi bırakan avukat ücret
 *    isteyemez, peşini iade eder.
 *  - HMK m.74/1: özel yetki listesinde "ahzu kabz" YOK; kanun yolları için
 *    yalnız "feragat" var.
 *  - İİK m.62: ilamsız takipte 7 gün, icra dairesine. İİK m.168: kambiyo
 *    senetlerine mahsus takipte itirazlar 5 gün, İCRA MAHKEMESİNE.
 * Bu test hukukî isabeti değil, kodun bu metinlerle çelişmediğini denetler.
 */

const temel = (o: Partial<ContractInput> = {}): ContractInput => ({
  tur: 'vekalet',
  avukatAd: 'Ayşe Yılmaz',
  muvekkilAd: 'Mehmet Demir',
  feeModel: 'maktu',
  maktuTutar: 50000,
  ...o,
});
const danisma = (o: Partial<ContractInput> = {}) =>
  temel({ tur: 'danismanlik', feeModel: 'danismanlik', aylikDanismanlik: 15000, ...o });

const madde = (body: string, baslik: string) => {
  const m = body.match(new RegExp(`MADDE \\d+ — ${baslik}\\n([^\\n]*)`));
  return m ? m[1]! : '';
};

describe('müvekkil seçilince form alanları (bulgu 1, 5)', () => {
  it('TC ve adres müvekkil kaydından gelir', () => {
    expect(muvekkilFormAlanlari({ full_name: 'A B', tc_no: '10000000146', address: 'Ankara' })).toEqual({
      ad: 'A B',
      tc: '10000000146',
      adres: 'Ankara',
    });
  });

  it('kayıtta TC yoksa önceki müvekkilin TC\'si kalmaz — boş döner', () => {
    expect(muvekkilFormAlanlari({ full_name: 'C D', tc_no: null, address: null })).toEqual({ ad: 'C D', tc: '', adres: '' });
  });
});

describe('sözleşme eksik veri uyarıları (bulgu 5)', () => {
  const uyari = (r: { warnings: string[] }, p: string) => r.warnings.some((w) => w.includes(p));

  it('vekâlette iş konusu hiç yoksa m.163 "belli hukukî yardım" uyarısı', () => {
    expect(uyari(buildContract(temel()), 'belli bir hukukî yardım')).toBe(true);
    expect(uyari(buildContract(temel({ uyusmazlik: 'Boşanma' })), 'belli bir hukukî yardım')).toBe(false);
    expect(uyari(buildContract(temel({ hukukAlani: 'Tüketici' })), 'belli bir hukukî yardım')).toBe(false);
  });

  it('imza yeri ve müvekkil adresi boşsa uyarır, doluysa uyarmaz', () => {
    const bos = buildContract(temel());
    expect(uyari(bos, 'İmza yeri girilmedi')).toBe(true);
    expect(uyari(bos, 'Müvekkil adresi girilmedi')).toBe(true);
    const dolu = buildContract(temel({ imzaYeri: 'Ankara', muvekkilAdres: 'Çankaya/Ankara' }));
    expect(uyari(dolu, 'İmza yeri girilmedi')).toBe(false);
    expect(uyari(dolu, 'Müvekkil adresi girilmedi')).toBe(false);
  });
});

describe('Av.K. atıfları metinle uyumlu (bulgu 7)', () => {
  it('m.163 uyarısı yazılı şekli GEÇERLİLİK şartı gibi sunmaz', () => {
    const w = buildContract(temel()).warnings.find((x) => x.includes('m. 163') && x.includes('yazılı'))!;
    expect(w).toBeTruthy();
    expect(w).toMatch(/ispat/i);
    expect(w).not.toMatch(/yazılı yapılmalı/i);
  });

  it('ücret girilmedi uyarısı tarifeyi tek ölçüt diye sunmaz (m.164)', () => {
    const w = buildContract(temel({ maktuTutar: undefined })).warnings.find((x) => x.startsWith('Ücret girilmedi'))!;
    expect(w).toContain('Asgari Ücret Tarifesi');
    expect(w).toContain('m. 164');
    expect(w).not.toContain('Tarifesi uygulanır');
  });

  it('vekâlet sözleşmesi azil maddesi m.174 ile aynı: azilde tamamı, kusur/ihmalde ödenmez, haksız bırakmada iade', () => {
    const m = madde(buildContract(temel()).body, 'AZİL VE İSTİFA');
    expect(m).toContain('m. 174');
    expect(m).toMatch(/kusur veya ihmal/);
    expect(m).toMatch(/hiçbir ücret isteyemez/);
    expect(m).toMatch(/iade/);
    // Eski metin azilde "haklı sebep olmaksızın" şartı arıyordu: m.174 böyle bir şart koymaz.
    expect(m).not.toMatch(/Haklı bir sebep olmaksızın azil/);
  });
});

describe('danışmanlık sözleşmesi azil/fesih çelişkisi (bulgu 8)', () => {
  it('fesih 30 gün bildirimle yapılırken azilde "ücretin tamamı" denmez', () => {
    const r = buildContract(danisma());
    const fesih = madde(r.body, 'SÜRE VE FESİH');
    const azil = madde(r.body, 'AZİL VE İSTİFA');
    expect(fesih).toContain('30 (otuz) gün');
    expect(azil).not.toMatch(/ücretin tamamı/);
    expect(azil).toContain('SÜRE VE FESİH');
  });
});

describe('vekâletname formu (bulgu 2, 3, 4)', () => {
  it('müvekkil listesi 30 ile sınırlanmaz; arama adı süzer', () => {
    const liste = Array.from({ length: 80 }, (_, i) => ({ id: String(i), full_name: `Müvekkil ${i}` }));
    expect(musteriFiltrele(liste, '')).toHaveLength(80);
    expect(musteriFiltrele(liste, 'müvekkil 7').map((c) => c.id)).toEqual(['7', '70', '71', '72', '73', '74', '75', '76', '77', '78', '79']);
  });

  it('arama Türkçe büyük/küçük harfi doğru eşler (İ/ı)', () => {
    const liste = [{ id: 'a', full_name: 'İsmail Işık' }];
    expect(musteriFiltrele(liste, 'ismail')).toHaveLength(1);
    expect(musteriFiltrele(liste, 'IŞIK')).toHaveLength(1);
  });

  it('düzenleme tarihi GG.AA.YYYY ve ISO kabul edilir; boş boştur; çöp HATADIR (sessizce null olmaz)', () => {
    expect(duzenlemeTarihi('15.01.2026')).toEqual({ ok: true, value: '2026-01-15' });
    expect(duzenlemeTarihi(' 2026-01-15 ')).toEqual({ ok: true, value: '2026-01-15' });
    expect(duzenlemeTarihi('')).toEqual({ ok: true, value: null });
    expect(duzenlemeTarihi('31.02.2026')).toEqual({ ok: false });
    expect(duzenlemeTarihi('geçen yıl')).toEqual({ ok: false });
  });

  it('durum değişince status_date bugünün YEREL tarihi olur; aktif\'e dönüşte temizlenir', () => {
    const bugun = new Date(2026, 9, 10, 0, 30); // yerel 10 Ekim 00:30
    expect(durumGuncellemesi('azil', bugun)).toEqual({ status: 'azil', status_date: '2026-10-10' });
    expect(durumGuncellemesi('istifa', bugun)).toEqual({ status: 'istifa', status_date: '2026-10-10' });
    expect(durumGuncellemesi('aktif', bugun)).toEqual({ status: 'aktif', status_date: null });
  });
});

describe('dilekçe şablonları (bulgu 6, 7)', () => {
  const sablon = (key: string) => PETITION_TEMPLATES.find((p) => p.key === key)!;

  it('vareste: "sorgusu yapılmış" gibi bir OLGU şablonda hazır iddia edilmez, köşeli alanda durur', () => {
    const b = sablon('vareste').body;
    // Düz metinde geçmez (köşeli parantez dışında):
    const parantezsiz = b.replace(/\[[^\]]*\]/g, '');
    expect(parantezsiz).not.toMatch(/sorgusu yapılmış/);
    expect(parantezsiz).not.toMatch(/zorunlu bir işlem kalmamıştır/);
    // ama avukat isterse kullanabilsin diye alan olarak durur:
    expect(b).toMatch(/\[YARGILAMANIN AŞAMASI[^\]]*sorgu/);
  });

  it('icra itirazı: 7 gün/icra dairesi yalnız ilamsız takip için; kambiyoda 5 gün/icra mahkemesi uyarısı (İİK 62, 168)', () => {
    const d = sablon('icra-itiraz').description;
    expect(d).toContain('lamsız takip');
    expect(d).toContain('7 gün');
    expect(d).toContain('kambiyo');
    expect(d).toContain('5 gün');
    expect(d).toContain('icra mahkemesi');
    expect(d).toContain('168');
  });
});
