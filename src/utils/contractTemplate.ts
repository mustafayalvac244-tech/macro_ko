// Avukatlık Ücret Sözleşmesi / Sürekli Hukukî Danışmanlık Sözleşmesi üreticisi.
//
// Şablon tabanlı, tamamen cihazda çalışır (AI yok, sunucuya veri gitmez).
// Metinler Avukatlık Kanunu (1136 s.) m. 163-164 ve 174 ile Avukatlık Asgari
// Ücret Tarifesi çerçevesindeki YERLEŞİK standart maddelerden oluşur. Üretilen
// belge bilgilendirme/taslak niteliğindedir; imzadan önce avukatça gözden
// geçirilmelidir (aşağıdaki "hukukî kontrol" uyarıları bu amaçla döner).

export type FeeModel = 'maktu' | 'nispi' | 'karma' | 'danismanlik';
export type ContractType = 'vekalet' | 'danismanlik';

export interface Taksit {
  seq: number;
  amount: number;
  dueDate?: string;
}

export interface ContractInput {
  tur: ContractType;
  // Taraflar
  avukatAd: string;
  baro?: string;
  sicil?: string;
  buro?: string;
  buroAdres?: string;
  muvekkilAd: string;
  muvekkilTc?: string;
  muvekkilAdres?: string;
  // İş / konu
  hukukAlani?: string;
  uyusmazlik?: string;
  mahkeme?: string;
  sifat?: string;
  imzaYeri?: string;
  tarih?: string;
  // Ücret
  feeModel: FeeModel;
  maktuTutar?: number;
  nispiOran?: number;
  davaDegeri?: number;
  kdvDahil?: boolean;
  aylikDanismanlik?: number;
  taksitler?: Taksit[];
}

export interface ContractResult {
  title: string;
  body: string;
  warnings: string[];
}

function money(n: number | undefined): string {
  if (n == null || isNaN(n)) return '—';
  // Binlik ayracı (nokta) — Intl'e bağımlı değil, Hermes'te de güvenli.
  const s = Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${s} TL`;
}

/** Nispi ücret tutarı (dava değeri × oran). İkisi de varsa hesaplanır. */
function nispiTutar(input: ContractInput): number | null {
  if (input.davaDegeri && input.nispiOran) {
    return Math.round((input.davaDegeri * input.nispiOran) / 100);
  }
  return null;
}

function ucretMaddesi(input: ContractInput): string {
  const kdvNot = input.kdvDahil ? 'KDV dâhildir' : 'KDV hariçtir';
  switch (input.feeModel) {
    case 'maktu':
      return `Avukatlık ücreti MAKTU olarak ${money(input.maktuTutar)} (${kdvNot}) kararlaştırılmıştır.`;
    case 'nispi': {
      const t = nispiTutar(input);
      const oran = input.nispiOran != null ? `%${input.nispiOran}` : '(oran belirtilmedi)';
      const deg = input.davaDegeri != null ? `${money(input.davaDegeri)} dava değeri üzerinden` : '';
      const hesap = t != null ? ` Hesaplanan tutar: ${money(t)} (${kdvNot}).` : '';
      return `Avukatlık ücreti NİSPİ olarak, ${deg} ${oran} oranında kararlaştırılmıştır.${hesap}`;
    }
    case 'karma': {
      const t = nispiTutar(input);
      const oran = input.nispiOran != null ? `%${input.nispiOran}` : '(oran belirtilmedi)';
      const hesap = t != null ? ` (nispi kısım yaklaşık ${money(t)})` : '';
      return `Avukatlık ücreti KARMA olarak; peşin MAKTU ${money(input.maktuTutar)} ve dava sonucuna bağlı NİSPİ ${oran}${hesap} biçiminde kararlaştırılmıştır (${kdvNot}).`;
    }
    case 'danismanlik':
      return `Sürekli hukukî danışmanlık ücreti AYLIK ${money(input.aylikDanismanlik)} (${kdvNot}) olarak kararlaştırılmıştır.`;
  }
}

function taksitMaddesi(taksitler?: Taksit[]): string {
  if (!taksitler || taksitler.length === 0) {
    return 'Ücret, işbu sözleşmenin imzası ile muaccel olup peşin ödenir.';
  }
  const satirlar = taksitler
    .map(
      (t) =>
        `   ${t.seq}. Taksit: ${money(t.amount)} — Vade: ${t.dueDate ? t.dueDate : `imzadan itibaren ${t.seq}. ayın sonu`}`
    )
    .join('\n');
  const toplam = taksitler.reduce((s, t) => s + (t.amount || 0), 0);
  return (
    `Ücret aşağıdaki taksitler hâlinde ödenecektir:\n${satirlar}\n   Toplam: ${money(toplam)}\n` +
    `Herhangi bir taksitin vadesinde ödenmemesi hâlinde, kalan taksitlerin tamamı muaccel hâle gelir ve ödeme tarihine kadar yasal temerrüt faizi işletilir.`
  );
}

/** Konusu para ile ölçülemeyen alanlarda nispi ücret sakıncalıdır. */
function nispiSakincaliMi(hukukAlani?: string): boolean {
  if (!hukukAlani) return false;
  const a = hukukAlani.toLocaleLowerCase('tr');
  return a.includes('aile') || a.includes('ceza') || a.includes('idare');
}

/** Sözleşmeyi ve hukukî kontrol uyarılarını üretir. */
export function buildContract(input: ContractInput): ContractResult {
  const isDanisma = input.tur === 'danismanlik';
  const title = isDanisma ? 'SÜREKLİ HUKUKÎ DANIŞMANLIK SÖZLEŞMESİ' : 'AVUKATLIK ÜCRET SÖZLEŞMESİ';
  const tarih = input.tarih || new Date().toLocaleDateString('tr-TR');

  const avukatSatiri = [
    `Av. ${input.avukatAd}`,
    input.baro ? `${input.baro} Barosu` : null,
    input.sicil ? `Sicil No: ${input.sicil}` : null,
    input.buro ? input.buro : null,
    input.buroAdres ? `Adres: ${input.buroAdres}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  const muvekkilSatiri = [
    input.muvekkilAd,
    input.muvekkilTc ? `T.C. Kimlik No: ${input.muvekkilTc}` : null,
    input.muvekkilAdres ? `Adres: ${input.muvekkilAdres}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  // MADDE 2 — düzyazı konu (form dökümü değil).
  let konu: string;
  if (isDanisma) {
    konu =
      `İşbu sözleşme ile AVUKAT, MÜVEKKİL'e ${input.hukukAlani ? input.hukukAlani + ' başta olmak üzere ' : ''}` +
      `karşılaşacağı hukukî konularda sürekli danışmanlık; sözleşme/ihtarname incelemesi, hukukî görüş ve yazışmaların hazırlanması ile telefon/e-posta yoluyla destek hizmeti verecektir. Dava ve icra takibi bu sözleşmenin kapsamı dışında olup ayrıca ücretlendirilir.`;
  } else {
    const alan = input.hukukAlani ? `${input.hukukAlani} alanındaki ` : '';
    const is = input.uyusmazlik ? `"${input.uyusmazlik}" konulu ` : '';
    const merci = input.mahkeme ? `${input.mahkeme} nezdinde ` : '';
    const sft = input.sifat ? `MÜVEKKİL'in ${input.sifat} sıfatıyla ` : '';
    konu =
      `AVUKAT, ${alan}${is}iş/davada ${merci}${sft}MÜVEKKİL'i temsil ve takip etmeyi üstlenir. ` +
      `AVUKAT'ın yükümlülüğü, işi özen ve sadakatle yürütmek olup davanın belirli bir sonuçla neticeleneceği taahhüt edilmez.`;
  }

  // Maddeler sırayla toplanır, numaralar otomatik verilir.
  const items: { baslik: string; icerik: string }[] = [];
  items.push({ baslik: 'TARAFLAR', icerik: `AVUKAT: ${avukatSatiri || '—'}\nMÜVEKKİL: ${muvekkilSatiri || '—'}` });
  items.push({ baslik: 'SÖZLEŞMENİN KONUSU', icerik: konu });
  items.push({ baslik: isDanisma ? 'DANIŞMANLIK ÜCRETİ' : 'AVUKATLIK ÜCRETİ', icerik: ucretMaddesi(input) });
  items.push({ baslik: 'ÖDEME KOŞULLARI', icerik: taksitMaddesi(input.taksitler) });
  if (isDanisma) {
    items.push({
      baslik: 'SÜRE VE FESİH',
      icerik:
        'Sözleşme, imza tarihinden itibaren 1 (bir) yıl süreyle geçerlidir ve taraflarca aksi bildirilmedikçe birer yıllık dönemler hâlinde kendiliğinden yenilenir. Taraflardan her biri, en az 30 (otuz) gün önceden yazılı bildirimde bulunmak kaydıyla sözleşmeyi feshedebilir. Fesih, işlemekte olan döneme ait ücret alacağını etkilemez.',
    });
  }
  items.push({
    baslik: 'MÜVEKKİLİN YÜKÜMLÜLÜKLERİ',
    icerik:
      "MÜVEKKİL; AVUKAT'a gerekli vekâletnameyi verir, işe ilişkin tüm bilgi ve belgeleri eksiksiz ve doğru olarak zamanında sunar, istenen masraf avansını yatırır. Bilgi/belgelerin eksik veya gerçeğe aykırı olmasından doğan sonuçlardan MÜVEKKİL sorumludur.",
  });
  items.push({
    baslik: 'YARGILAMA GİDERLERİ VE MASRAFLAR',
    icerik:
      "Harç, tebligat, bilirkişi, keşif, posta, dosya ve benzeri tüm yargılama/işlem giderleri MÜVEKKİL'e aittir. AVUKAT tarafından yapılan zorunlu masraflar MÜVEKKİL tarafından derhâl karşılanır.",
  });
  items.push({
    baslik: 'KARŞI YANA YÜKLETİLEN VEKÂLET ÜCRETİ',
    icerik:
      "Mahkeme veya icra yoluyla karşı tarafa yükletilecek vekâlet ücreti, Avukatlık Kanunu m. 164/son uyarınca aksi işbu sözleşmede yazılı olarak kararlaştırılmadıkça AVUKAT'a aittir ve yukarıdaki avukatlık ücretinden ayrıdır.",
  });
  if (!isDanisma) {
    items.push({
      baslik: 'VEKÂLETİN KAPSAMI',
      icerik:
        "AVUKAT, işin niteliğinin gerektirdiği hukukî işlemleri yürütmeye yetkilidir. Sulh, feragat, kabul, davadan vazgeçme, ibra ve tahkim gibi tasarrufî işlemler MÜVEKKİL'in ayrıca vereceği özel yetkiye tâbidir.",
    });
  }
  items.push({
    baslik: 'AZİL VE İSTİFA',
    icerik:
      "Haklı bir sebep olmaksızın azil hâlinde, Avukatlık Kanunu m. 174 uyarınca kararlaştırılan ücretin tamamı AVUKAT'a ödenir. AVUKAT'ın haklı sebeple istifası hâlinde de aynı hüküm uygulanır.",
  });
  items.push({
    baslik: 'GİZLİLİK VE KİŞİSEL VERİLER',
    icerik:
      "AVUKAT, MÜVEKKİL'e ait bilgi ve belgeleri meslek sırrı kapsamında gizli tutar. Kişisel veriler yalnızca işin görülmesi amacıyla, 6698 sayılı KVKK'ya uygun olarak işlenir ve saklanır.",
  });
  items.push({
    baslik: 'TEBLİGAT ADRESLERİ',
    icerik:
      'Tarafların işbu sözleşmede yazılı adresleri yasal tebligat adresleridir. Adres değişikliği yazılı olarak bildirilmedikçe bu adreslere yapılan tebligat geçerli sayılır.',
  });
  items.push({
    baslik: 'UYUŞMAZLIK, NÜSHA VE YÜRÜRLÜK',
    icerik:
      `İşbu sözleşmeden doğacak uyuşmazlıklarda ${input.imzaYeri || '…………'} mahkemeleri ve icra daireleri yetkilidir. ` +
      `Sözleşme ${items.length + 1} maddeden ibaret olup iki (2) nüsha düzenlenmiş, taraflarca ${tarih} tarihinde imzalanarak yürürlüğe girmiştir. Bir nüsha MÜVEKKİL'e verilmiştir.`,
  });

  const maddeler = items.map((it, i) => `MADDE ${i + 1} — ${it.baslik}\n${it.icerik}`);

  const imza = `\nTARAFLAR\n\nAVUKAT\n${input.avukatAd ? 'Av. ' + input.avukatAd : '…………………'}\nİmza:\n\nMÜVEKKİL\n${input.muvekkilAd || '…………………'}\nİmza:\n\nDüzenlenme Yeri/Tarihi: ${input.imzaYeri || '…………'} / ${tarih}`;

  const body = `${title}\n\n${maddeler.join('\n\n')}\n${imza}`;

  // ── Hukukî kontrol uyarıları ────────────────────────────────────────────
  const warnings: string[] = [];
  const hasFee =
    (input.feeModel === 'maktu' && input.maktuTutar) ||
    (input.feeModel === 'nispi' && (input.nispiOran || input.davaDegeri)) ||
    (input.feeModel === 'karma' && (input.maktuTutar || input.nispiOran)) ||
    (input.feeModel === 'danismanlik' && input.aylikDanismanlik);
  if (!hasFee) {
    warnings.push(
      'Ücret girilmedi. Ücret kararlaştırılmazsa Avukatlık Asgari Ücret Tarifesi uygulanır (Av.K. m. 163-164).'
    );
  }
  if ((input.feeModel === 'nispi' || input.feeModel === 'karma') && nispiSakincaliMi(input.hukukAlani)) {
    warnings.push(
      'Seçtiğiniz alanda (aile/ceza/idare) uyuşmazlık çoğunlukla para ile ölçülemez. Bu tür işlerde nispi (yüzde) ücret uygun olmayabilir; maktu ücret önerilir.'
    );
  }
  if ((input.feeModel === 'nispi' || input.feeModel === 'karma') && (input.nispiOran ?? 0) > 25) {
    warnings.push(
      `Girdiğiniz nispi oran (%${input.nispiOran}), Avukatlık Kanunu m. 164/2'deki %25 üst sınırının üzerindedir. Bu sınırı aşan kısım geçersiz sayılabilir.`
    );
  }
  if (input.feeModel === 'nispi' && !input.davaDegeri) {
    warnings.push('Nispi ücrette dava/işin değeri girilmedi; tutar hesaplanamadı.');
  }
  if (!input.muvekkilAd || !input.avukatAd) {
    warnings.push('Taraf bilgileri eksik. Avukat ve müvekkil ad-soyad alanları doldurulmalıdır.');
  }
  warnings.push(
    'Avukatlık sözleşmesi yazılı yapılmalı ve iki tarafça imzalanmalıdır (Av.K. m. 163). Bu taslağı imzadan önce gözden geçirin.'
  );

  return { title, body, warnings };
}
