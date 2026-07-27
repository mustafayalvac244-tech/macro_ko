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
    .map((t) => `   ${t.seq}. Taksit: ${money(t.amount)}${t.dueDate ? ` — Vade: ${t.dueDate}` : ''}`)
    .join('\n');
  const toplam = taksitler.reduce((s, t) => s + (t.amount || 0), 0);
  return `Ücret aşağıdaki taksitler hâlinde ödenecektir:\n${satirlar}\n   Toplam: ${money(toplam)}`;
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

  const konu = isDanisma
    ? `İşbu sözleşme, MÜVEKKİL'in ${input.hukukAlani || 'hukukî'} işlerinde AVUKAT'tan sürekli hukukî danışmanlık ve destek alması konusundaki hak ve yükümlülükleri düzenler.`
    : [
        `AVUKAT, MÜVEKKİL'i aşağıda tanımlanan iş/dava kapsamında temsil ve takip edecektir:`,
        input.hukukAlani ? `   • Hukuk Alanı: ${input.hukukAlani}` : null,
        input.uyusmazlik ? `   • Konu / Uyuşmazlık: ${input.uyusmazlik}` : null,
        input.mahkeme ? `   • Yetkili Merci / Mahkeme: ${input.mahkeme}` : null,
        input.sifat ? `   • Müvekkilin Sıfatı: ${input.sifat}` : null,
      ]
        .filter(Boolean)
        .join('\n');

  const maddeler: string[] = [];
  maddeler.push(`MADDE 1 — TARAFLAR\nAVUKAT: ${avukatSatiri || '—'}\nMÜVEKKİL: ${muvekkilSatiri || '—'}`);
  maddeler.push(`MADDE 2 — SÖZLEŞMENİN KONUSU\n${konu}`);
  maddeler.push(`MADDE 3 — AVUKATLIK ÜCRETİ\n${ucretMaddesi(input)}`);
  maddeler.push(`MADDE 4 — ÖDEME\n${taksitMaddesi(input.taksitler)}`);
  maddeler.push(
    `MADDE 5 — YARGILAMA GİDERLERİ\nHarç, tebligat, bilirkişi, keşif, posta ve benzeri tüm yargılama/işlem giderleri MÜVEKKİL'e aittir. AVUKAT tarafından yapılan zorunlu masraflar MÜVEKKİL tarafından derhâl karşılanır.`
  );
  maddeler.push(
    `MADDE 6 — KARŞI YAN VEKÂLET ÜCRETİ\nMahkeme/icra yoluyla karşı tarafa yükletilecek vekâlet ücreti, Avukatlık Kanunu m. 164/son uyarınca aksi burada yazılı olarak kararlaştırılmadıkça AVUKAT'a aittir.`
  );
  if (!isDanisma) {
    maddeler.push(
      `MADDE 7 — VEKÂLETİN KAPSAMI\nAVUKAT, işin niteliğinin gerektirdiği hukukî işlemleri yürütmeye yetkilidir. Sulh, feragat, kabul, davadan vazgeçme gibi tasarruf işlemleri MÜVEKKİL'in ayrıca vereceği özel yetkiye tâbidir.`
    );
  }
  maddeler.push(
    `MADDE ${isDanisma ? 7 : 8} — AZİL VE İSTİFA\nHaklı bir sebep olmaksızın azil hâlinde, Avukatlık Kanunu m. 174 uyarınca ücretin tamamı AVUKAT'a ödenir. AVUKAT'ın haklı sebeple istifası hâlinde de aynı hüküm uygulanır.`
  );
  maddeler.push(
    `MADDE ${isDanisma ? 8 : 9} — GİZLİLİK VE KİŞİSEL VERİLER\nAVUKAT, MÜVEKKİL'e ait bilgi ve belgeleri meslek sırrı kapsamında gizli tutar; kişisel veriler yalnızca işin görülmesi amacıyla ve KVKK'ya uygun olarak işlenir.`
  );
  maddeler.push(
    `MADDE ${isDanisma ? 9 : 10} — UYUŞMAZLIK VE YÜRÜRLÜK\nİşbu sözleşmeden doğacak uyuşmazlıklarda ${input.imzaYeri || '…………'} mahkemeleri ve icra daireleri yetkilidir. Sözleşme, taraflarca imzalandığı ${tarih} tarihinde yürürlüğe girer.`
  );

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
