import { describe, expect, it } from 'vitest';
import { havuzSorgusu, kararAtiflari, tutarsizKararlar } from '../supabase/functions/_shared/kararAtif';

/**
 * KARAR ATFI DENETİMİ.
 *
 * Bu ayıklayıcı, avukatın gördüğü en pahalı uyarıyı üretiyor: "bu karar
 * numarası olamaz". Yanlış pozitif burada madde denetimindekinden de pahalı,
 * çünkü gerçek bir Yargıtay kararını "olanaksız" diye işaretlersek avukat
 * uyarıya bir daha bakmaz. Bu yüzden testlerin yarısı, olması gerekeni değil,
 * OLMAMASI gerekeni kontrol ediyor.
 */
describe('kararAtiflari', () => {
  it('esas ve karar numarasını tek atıf olarak eşler', () => {
    const a = kararAtiflari("Yargıtay 9. Hukuk Dairesi'nin 2019/12345 E., 2020/6789 K. sayılı kararı");
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({
      mahkeme: 'Yargıtay',
      daireTur: 'HD',
      daireNo: 9,
      esasYil: 2019,
      esasNo: '12345',
      kararYil: 2020,
      kararNo: '6789',
    });
  });

  it('kısaltmalı yazılışı da okur', () => {
    const a = kararAtiflari('Y. 22. HD 2016/1111 E. 2017/2222 K.');
    expect(a[0]).toMatchObject({ mahkeme: 'Yargıtay', daireTur: 'HD', daireNo: 22 });
  });

  it('yalnız esas verilen atfı düşürmez', () => {
    // Karar numarası olmadan da UYAP'ta aranabilir; atıf geçerlidir.
    const a = kararAtiflari('Yargıtay 4. HD 2021/500 E. sayılı dosya');
    expect(a).toHaveLength(1);
    expect(a[0].kararYil).toBe(0);
    expect(a[0].esasNo).toBe('500');
  });

  it('genel kurul esas numarasındaki tireli kısmı korur', () => {
    const a = kararAtiflari('HGK 2020/1-123 E., 2021/45 K.');
    expect(a[0].esasNo).toBe('1-123');
    // Genel kurulda daire yoktur: "2020/1" içindeki 1'i daire sanmamalı.
    expect(a[0].daireNo).toBe(0);
    expect(a[0].daireTur).toBe('');
  });

  it('Danıştay dairesini hukuk dairesi sanmaz', () => {
    const a = kararAtiflari('Danıştay 10. Daire 2018/123 E., 2019/456 K.');
    expect(a[0]).toMatchObject({ mahkeme: 'Danıştay', daireTur: 'D', daireNo: 10 });
  });

  it('harf ile devam eden metni atıf sanmaz', () => {
    // "2020/12 Ekim" bir atıf değildir; E harfinden sonra harf geliyor.
    expect(kararAtiflari('2020/12 Ekim tarihli yazı')).toEqual([]);
  });

  it('aynı atıf iki kez geçse tek kez sorar', () => {
    const metin = '2019/1 E., 2020/2 K. ... yine 2019/1 E., 2020/2 K.';
    expect(kararAtiflari(metin)).toHaveLength(1);
  });

  it('araya uzun cümle girerse esas ile kararı eşleştirmez', () => {
    // 40 karakterden uzak iki numara farklı kararlara aittir; zorla eşlemek
    // var olmayan bir "2019/1 E. - 2021/9 K." çifti uydurur.
    const metin = '2019/1 E. sayılı dosyada verilen ve kesinleşen hükmün ardından 2021/9 K.';
    const a = kararAtiflari(metin);
    expect(a).toHaveLength(2);
    expect(a[0].kararYil).toBe(0);
  });

  it('madde atfını karar atfı sanmaz', () => {
    expect(kararAtiflari('HMK m.119/1-d ve TBK m.146')).toEqual([]);
  });
});

describe('tutarsizKararlar', () => {
  const bugun = 2026;

  it('karar yılı esas yılından önceyse olanaksız sayar', () => {
    // Dosya açılmadan karar verilemez. Korpustan bağımsız, aritmetik gerçek.
    const a = kararAtiflari('Yargıtay 9. HD 2020/100 E., 2018/200 K.');
    expect(tutarsizKararlar(a, bugun)).toEqual([{ atif: a[0], sebep: 'karar_esastan_once' }]);
  });

  it('gelecek yıl numarasını olanaksız sayar', () => {
    const a = kararAtiflari('Yargıtay 9. HD 2030/100 E., 2031/200 K.');
    expect(tutarsizKararlar(a, bugun)[0].sebep).toBe('gelecek_yil');
  });

  it('hiç var olmamış daireyi olanaksız sayar', () => {
    const a = kararAtiflari('Yargıtay 47. Hukuk Dairesi 2019/1 E., 2020/2 K.');
    expect(tutarsizKararlar(a, bugun)[0].sebep).toBe('daire_yok');
  });

  it('kapatılmış ama gerçekten var olmuş daireyi olanaksız SAYMAZ', () => {
    // 22. HD 2020'de kapandı; 2016 tarihli kararı bugün de atıf konusudur.
    // Dar aralık alsaydık gerçek kararı uydurma diye işaretlerdik.
    const a = kararAtiflari('Yargıtay 22. HD 2016/1111 E., 2017/2222 K.');
    expect(tutarsizKararlar(a, bugun)).toEqual([]);
  });

  it('havuzda olmayan ama tutarlı atfı olanaksız SAYMAZ', () => {
    // Havuzumuzda ~11 bin karar var, Yargıtay milyonlarca karar verdi.
    // Bulamamak bizim eksiğimizdir; burada susmak zorundayız.
    const a = kararAtiflari('Yargıtay 3. HD 2015/9999 E., 2016/8888 K.');
    expect(tutarsizKararlar(a, bugun)).toEqual([]);
  });

  it('aynı yıl içinde verilen kararı olanaksız saymaz', () => {
    const a = kararAtiflari('Yargıtay 9. HD 2020/100 E., 2020/200 K.');
    expect(tutarsizKararlar(a, bugun)).toEqual([]);
  });
});

describe('havuzSorgusu', () => {
  it('yalnız aranabilir alanları taşır', () => {
    const a = kararAtiflari('Yargıtay 9. HD 2019/12345 E., 2020/6789 K.');
    expect(havuzSorgusu(a)).toEqual([{ esas: '2019/12345', karar: '2020/6789' }]);
  });

  it('karar numarası yoksa boş bırakır', () => {
    const a = kararAtiflari('Yargıtay 4. HD 2021/500 E.');
    expect(havuzSorgusu(a)).toEqual([{ esas: '2021/500', karar: '' }]);
  });
});
