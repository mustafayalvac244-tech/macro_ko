import { describe, expect, it } from 'vitest';
import {
  daireAnahtari,
  daireUyumlu,
  havuzSorgusu,
  kararAtiflari,
  kunyeCumlesi,
  kunyeleriDegistir,
  oneriCumlesiYeterli,
  tutarsizKararlar,
} from '../supabase/functions/_shared/kararAtif';

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
    expect(havuzSorgusu(a)).toEqual([{ esas: '2019/12345', karar: '2020/6789', daire: '9HD' }]);
  });

  it('karar numarası yoksa boş bırakır', () => {
    const a = kararAtiflari('Yargıtay 4. HD 2021/500 E.');
    expect(havuzSorgusu(a)).toEqual([{ esas: '2021/500', karar: '', daire: '4HD' }]);
  });
});

/**
 * ARKA ARKAYA İKİ KARAR — DAİRE KARIŞMASI.
 *
 * Bu blok, 12.09.2026'da anasayfanın canlı denetimini gerçek tarayıcıda
 * sınarken çıkan bir hatayı sabitliyor. Pencere atıftan ÖNCEKİ 90 karakterdi
 * ve daire araması penceredeki İLK eşleşmeyi alıyordu; oysa atfın kendi
 * dairesi pencerenin SONUNDA durur. Bir paragrafta iki karar anıldığında
 * ikincisinin dairesi birincisinden okunuyordu.
 *
 * Yanlış yönün ikisi de burada: yakalanmayan olanaksız daire ve — daha
 * pahalısı — gerçek bir kararın komşusundan daire miras alıp "olamaz" diye
 * işaretlenmesi.
 */
describe('aynı paragrafta birden çok karar', () => {
  it('her atfın dairesini KENDİ önündeki daireden okur', () => {
    const a = kararAtiflari(
      'Bu yönde Yargıtay 9. HD 2021/4412 E., 2019/1180 K. sayılı kararı ile ' +
        'Yargıtay 47. HD 2019/1 E., 2020/2 K. sayılı kararı emsaldir.'
    );
    expect(a).toHaveLength(2);
    expect(a[0].daireNo).toBe(9);
    expect(a[1].daireNo).toBe(47);
  });

  it('olmayan daireyi ikinci sırada da yakalar', () => {
    const a = kararAtiflari(
      'Yargıtay 9. HD 2018/100 E., 2019/200 K. ve Yargıtay 47. HD 2019/1 E., 2020/2 K.'
    );
    const sebepler = tutarsizKararlar(a, 2026).map((t) => t.sebep);
    expect(sebepler).toEqual(['daire_yok']);
  });

  it('gerçek kararı komşusunun dairesi yüzünden olanaksız SAYMAZ', () => {
    // Ters yön ve asıl pahalı olan: 47. HD'den sonra anılan gerçek bir
    // 3. HD kararı, önündeki daireyi miras alsaydı uydurma ilan edilirdi.
    const a = kararAtiflari(
      'Yargıtay 47. HD 2019/1 E., 2020/2 K. kararının aksine, ' +
        'Yargıtay 3. HD 2015/9999 E., 2016/8888 K. sayılı karar yerleşiktir.'
    );
    expect(a[1].daireNo).toBe(3);
    const tutarsiz = tutarsizKararlar(a, 2026);
    expect(tutarsiz).toHaveLength(1);
    expect(tutarsiz[0].atif.daireNo).toBe(47);
  });

  it('Danıştay dairesini de en yakınından okur', () => {
    const a = kararAtiflari(
      'Danıştay 10. Daire 2018/123 E., 2019/456 K. ve Danıştay 13. Daire 2020/5 E., 2021/6 K.'
    );
    expect(a[0].daireNo).toBe(10);
    expect(a[1].daireNo).toBe(13);
  });
});

/**
 * ÖNEKLİ YAZILIŞ — "E. 2019/12345 K. 2020/6789" (22. ajan, 10.10.2026).
 *
 * BULUNAN KUSUR. Ayıklayıcı yalnız SONEKLİ yazılışı ("2019/12345 E.") biliyordu.
 * Önekli yazılışta iki hata vardı:
 *  1. "E. 2019/1234, K. 2020/5678" HİÇ atıf üretmiyordu (denetim sessizce atlıyordu);
 *  2. bitişik "E.2019/12345 K.2020/6789" ESAS numarasını KARAR sanıyordu
 *     ("12345 K" sonek gibi okunuyor, gerçek karar numarası kayboluyordu).
 * Kendi öneri satırımız da bu biçimde ("… E. 2019/1 K. 2020/2") yazılıyor.
 */
describe('önekli yazılış', () => {
  it('"E. 2019/1234, K. 2020/5678" okunur (eskiden hiç atıf çıkmıyordu)', () => {
    const m = 'Yargıtay 9. HD, E. 2019/1234, K. 2020/5678 sayılı kararı uyarınca';
    const a = kararAtiflari(m);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({
      mahkeme: 'Yargıtay',
      daireTur: 'HD',
      daireNo: 9,
      esasYil: 2019,
      esasNo: '1234',
      kararYil: 2020,
      kararNo: '5678',
    });
    expect(m).toContain(a[0].ham);
  });

  it('bitişik "E.2019/12345 K.2020/6789" esası karar sanılmaz', () => {
    const a = kararAtiflari('Yargıtay 9. HD E.2019/12345 K.2020/6789 sayılı kararı');
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ esasYil: 2019, esasNo: '12345', kararYil: 2020, kararNo: '6789' });
  });

  it('"Esas No: … Karar No: …" ve "Esas: … Karar: …" okunur', () => {
    const a = kararAtiflari('Esas No: 2019/123, Karar No: 2020/456');
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ esasNo: '123', kararNo: '456', esasYil: 2019, kararYil: 2020 });
    const b = kararAtiflari('Esas: 2018/9 Karar: 2019/10');
    expect(b[0]).toMatchObject({ esasNo: '9', kararNo: '10' });
  });

  it('soneklide virgülsüz "2019/123 E. 2020/456 K." hâlâ tek çift', () => {
    // Önek okuyucusu "E. 2020/456"yı ikinci sayının önekiymiş gibi çalamaz.
    const a = kararAtiflari('Yargıtay 9. HD 2019/123 E. 2020/456 K. sayılı kararı');
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ esasYil: 2019, esasNo: '123', kararYil: 2020, kararNo: '456' });
  });

  it('iki yazılış aynı paragrafta; her atıf kendi dairesiyle', () => {
    const a = kararAtiflari(
      'Y. 9. HD 2019/123 E., 2020/456 K. ile Y. 3. HD E.2018/9 K.2019/10 sayılı kararlar'
    );
    expect(a).toHaveLength(2);
    expect(a[0]).toMatchObject({ daireNo: 9, esasNo: '123', kararNo: '456' });
    expect(a[1]).toMatchObject({ daireNo: 3, esasNo: '9', kararNo: '10' });
  });

  it('kelimenin içindeki harf etiket sayılmaz; etiketsiz "karar 2020/45" atıf değildir', () => {
    expect(kararAtiflari('DEK. 2019/12 tarihli')).toHaveLength(0);
    expect(kararAtiflari('Bu karar 2020/45 sayılı genelgeye dayanır')).toHaveLength(0);
  });
});

/**
 * BAM (BÖLGE ADLİYE) DAİRELERİ 23'ÜN ÜSTÜNE ÇIKAR (22. ajan, 10.10.2026).
 *
 * BULUNAN KUSUR. daire_yok denetimi Yargıtay için yazılmış tavanı (23) mahkemeye
 * bakmadan uyguluyordu: "İstanbul BAM 45. Hukuk Dairesi" gerçek bir daire olduğu
 * hâlde "olamaz" diye işaretlenip künyesi METİNDEN SİLİNİYORDU.
 */
describe('BAM dairesi daire_yok sayılmaz', () => {
  it('Bölge Adliye Mahkemesi 45. Hukuk Dairesi olanaksız DEĞİL', () => {
    const a = kararAtiflari("İstanbul Bölge Adliye Mahkemesi 45. Hukuk Dairesi'nin 2022/1234 E., 2023/567 K. sayılı kararı");
    expect(a[0].mahkeme).toBe('BAM');
    expect(tutarsizKararlar(a, 2026)).toEqual([]);
  });

  it('kısaltmalı "İstanbul BAM 40. HD" de olanaksız DEĞİL', () => {
    const a = kararAtiflari('İstanbul BAM 40. HD 2022/1234 E., 2023/567 K.');
    expect(tutarsizKararlar(a, 2026)).toEqual([]);
  });

  it('mahkemesi yazılmamış "47. Hukuk Dairesi" Yargıtay diye ilan edilmez', () => {
    // Yargıtay olduğu söylenmemiş; BAM olabilir. Yanlış pozitif pahalı.
    const a = kararAtiflari("47. Hukuk Dairesi'nin 2019/1 E., 2020/2 K. sayılı kararı");
    expect(tutarsizKararlar(a, 2026)).toEqual([]);
  });
});

/**
 * "DOĞRULANDI" DAİREYE BAKAR (22. ajan, 10.10.2026).
 *
 * Esas numarası her dairede ayrı işler: "2019/1234" 3. HD'de de 9. HD'de de
 * olabilir. Yalnız numaraya bakan eşleşme, uydurma "9. HD 2019/1234" künyesini
 * başka dairenin gerçek kararıyla "doğrulandı" yapıyordu.
 */
describe('daire anahtarı', () => {
  it('daire adını sade anahtara indirger', () => {
    expect(daireAnahtari('Yargıtay 9. Hukuk Dairesi')).toBe('9HD');
    expect(daireAnahtari('9. Hukuk Dairesi')).toBe('9HD');
    expect(daireAnahtari('Yargıtay 3. Ceza Dairesi')).toBe('3CD');
    expect(daireAnahtari('Danıştay 10. Daire')).toBe('10D');
    expect(daireAnahtari('İstanbul Bölge Adliye Mahkemesi 12. Hukuk Dairesi')).toBe('12HD');
    expect(daireAnahtari('Yargıtay Hukuk Genel Kurulu')).toBe('');
    expect(daireAnahtari('')).toBe('');
  });

  it('havuz sorgusu atfın dairesini taşır; daire yoksa boş', () => {
    expect(havuzSorgusu(kararAtiflari('Yargıtay 10. CD 2019/5 E., 2020/6 K.'))[0].daire).toBe('10CD');
    expect(havuzSorgusu(kararAtiflari('Danıştay 4. Daire 2019/5 E., 2020/6 K.'))[0].daire).toBe('4D');
    expect(havuzSorgusu(kararAtiflari('2019/5 E., 2020/6 K.'))[0].daire).toBe('');
  });

  it('kayıtlı daire farklıysa uyumsuz; bilinmiyorsa uyumlu (eskisi gibi)', () => {
    const [a] = kararAtiflari('Yargıtay 9. HD 2019/1234 E., 2020/5678 K.');
    expect(daireUyumlu(a, 'Yargıtay 9. Hukuk Dairesi')).toBe(true);
    expect(daireUyumlu(a, 'Yargıtay 3. Hukuk Dairesi')).toBe(false);
    expect(daireUyumlu(a, 'Yargıtay 9. Ceza Dairesi')).toBe(false);
    expect(daireUyumlu(a, 'Yargıtay Hukuk Genel Kurulu')).toBe(true);
    expect(daireUyumlu(a, '')).toBe(true);
    const [b] = kararAtiflari('2019/1234 E., 2020/5678 K.');
    expect(daireUyumlu(b, 'Yargıtay 3. Hukuk Dairesi')).toBe(true);
  });
});

/**
 * "ÇIKARILDI" DEMEK İÇİN GERÇEKTEN ÇIKARILMALI (22. ajan, 10.10.2026).
 *
 * BULUNAN KUSUR. ham, boşlukları tek aralığa indirilmiş hâliyle tutuluyordu;
 * metinde satır sonu / çift boşluk varsa split(ham) hiçbir şey bulmuyor, künye
 * METİNDE KALIYOR ama ekran "n künye çıkarıldı" diyordu. Aynı künye başka
 * yazılışta (önek/sonek) tekrar geçerse tekrar-eleme yüzünden o da kalıyordu.
 */
describe('künyeleri metinden çıkarma', () => {
  it('satır sonu ve çift boşluklu künyeyi de çıkarır', () => {
    const m = 'Nitekim Yargıtay 9. HD 2019 / 12345  E.,\n2020/6789 K. sayılı karar böyledir.';
    const [a] = kararAtiflari(m);
    expect(m.includes(a.ham)).toBe(false); // eski split(ham) yöntemi bulamazdı
    const r = kunyeleriDegistir(m, [a.ham], '[X]');
    expect(r.metin).toBe('Nitekim Yargıtay 9. HD [X] sayılı karar böyledir.');
    expect(r.degisen).toEqual([a.ham]);
  });

  it('aynı künye iki yazılışta geçerse ikisini de çıkarır', () => {
    const m = 'Önce 2019/12345 E., 2020/6789 K. sonra E. 2019/12345, K. 2020/6789 yine.';
    const a = kararAtiflari(m);
    expect(a).toHaveLength(1);
    const r = kunyeleriDegistir(m, [a[0].ham], '[X]');
    expect(r.metin).toBe('Önce [X] sonra [X] yine.');
  });

  it('yalnız esası aynı olan başka (çiftli) künyeye dokunmaz', () => {
    const m = 'A 2019/123 E. sonra B 2019/123 E., 2020/4 K. biter.';
    const a = kararAtiflari(m);
    expect(a).toHaveLength(2);
    const r = kunyeleriDegistir(m, [a[0].ham], '[X]');
    expect(r.metin).toBe('A [X] sonra B 2019/123 E., 2020/4 K. biter.');
  });

  it('metinde olmayan künye için değişiklik bildirmez', () => {
    const r = kunyeleriDegistir('Künye yok.', ['2019/1 E., 2020/2 K.'], '[X]');
    expect(r.metin).toBe('Künye yok.');
    expect(r.degisen).toEqual([]);
  });
});

/**
 * ÖNERİ CÜMLESİ (22. ajan, 10.10.2026).
 *
 * BULUNAN KUSUR. Künyenin geçtiği cümle '.' işaretinde kesiliyordu; "Yargıtay
 * 9. HD" içindeki "9." cümle sonu sayılınca konu sözcükleri düşüyor, FTS'e
 * "HD sayılı kararında …" gibi bir artık gidiyor ve ekrana konuyla ilgisiz
 * "gerçek karar" öneriliyordu.
 */
describe('öneri cümlesi', () => {
  const m =
    'Giriş cümlesi burada biter. Kira artış oranının tespitinde Yargıtay 9. HD 2019/1 E., 2020/2 K. ' +
    'sayılı kararında TÜFE esas alınmıştır. Sonraki cümle başka konudur.';

  it('"9." sıra sayısında kesilmez, künye numarasını taşımaz, komşu cümleleri almaz', () => {
    const c = kunyeCumlesi(m, kararAtiflari(m)[0].ham);
    expect(c).toContain('Kira artış oranının tespitinde');
    expect(c).toContain('TÜFE esas alınmıştır');
    expect(c).not.toContain('2019/1');
    expect(c).not.toContain('Giriş');
    expect(c).not.toContain('Sonraki');
  });

  it('boşluk farkı olan künyenin cümlesini de bulur', () => {
    const n = 'Konu şudur. Kıdem tazminatının hesabında Yargıtay 9. HD 2019 / 1  E.,\n2020/2 K. sayılı kararı esas alınır.';
    const c = kunyeCumlesi(n, kararAtiflari(n)[0].ham);
    expect(c).toContain('Kıdem tazminatının hesabında');
    expect(c).not.toContain('2020/2');
  });

  it('yalnız künye kalıbı olan cümle öneri aramasına gönderilmez', () => {
    // Konu sözcüğü yok → FTS rastgele "Yargıtay" kararı döndürürdü.
    expect(oneriCumlesiYeterli('Yargıtay 9. HD sayılı kararı uyarınca')).toBe(false);
    expect(oneriCumlesiYeterli('')).toBe(false);
    expect(oneriCumlesiYeterli('Kira artış oranının tespitinde TÜFE esas alınmıştır')).toBe(true);
  });
});
