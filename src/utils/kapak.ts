import type { EnforcementCollection, EnforcementFile } from '@/types/database';

/**
 * Güncel kapak hesabı motoru.
 *
 * Basit (adi) faiz, gün bazında işler: asıl alacak × yıllık oran × gün / 365.
 * Tahsilatlar tarihe göre sıralanır; her tahsilat anına kadar biriken faiz
 * hesaplanır ve ödeme şu sırayla düşülür:
 *   1) masraflar + vekalet ücreti  2) birikmiş faiz  3) asıl alacak
 * Kalan asıl alacak azaldıkça sonraki dilimlerde faiz de azalır — avukatın
 * elle yaptığı kapak hesabının birebir karşılığı.
 *
 * HUKUKİ DAYANAK (10.10.2026 DÜZELTİLDİ). Bu sıra eskiden "İİK 138" diye
 * anılıyordu. İİK m.138 haczedilen malların satış bedelinin ALACAKLILAR
 * ARASINDA paylaştırılmasıyla ilgilidir; tek alacaklıya yapılan kısmi ödemenin
 * masraf/faiz/asıl sırasını düzenlemez (mevzuat.gov.tr metni bu denetimde
 * okunamadı; madde içeriği bir avukat sitesindeki metinden teyit edildi).
 * Dayanak TBK m.100 (RG 4.2.2011), okunan resmî metin: "Borçlu, faiz veya
 * giderleri ödemede gecikmemiş ise, kısmen yaptığı ödemeyi ana borçtan düşme
 * hakkına sahiptir. Aksine anlaşma yapılamaz." Yani faiz/giderde GECİKMİŞ
 * borçlu kısmi ödemeyi anaparaya yazdıramaz; uygulamada (Yargıtay 3. HD
 * 2020/2282, ikincil kaynaktan) ödeme önce gider ve faize mahsup edilir.
 * Masrafın faizden ÖNCE gelmesi TBK 100 metninde yazmaz; bu sıra toplam kalan
 * kapağı DEĞİŞTİRMEZ (faiz yalnız asıl alacak üzerinden işler), yalnız kalem
 * dağılımını etkiler.
 *
 * VARSAYIMLAR (ekranda da yazılıdır): girilen TEK oran tüm döneme uygulanır
 * (oran dönem içinde değiştiyse hesap yaklaşıktır) ve yıl 365 gün alınır
 * (artık yılda da). İkisi de ürün sahibi/hukuk kararı bekler.
 *
 * KURUŞ: her faiz dilimi kuruşa yuvarlanarak eklenir; kalan kalemler ve toplam
 * aynı kuruş değerlerinden çıkar (ekrandaki kalemler toplama TAM eşit olur).
 */

export interface KapakResult {
  /** Takip çıkışı: asıl + işlemiş faiz + masraf + vekalet ücreti */
  takipCikisi: number;
  /** Takip tarihinden bugüne işleyen faiz (tahsilatlar dikkate alınarak) */
  accruedInterest: number;
  /** Toplam tahsil edilen */
  collected: number;
  /** Bugün itibarıyla güncel kapak (kalan borç) */
  remaining: number;
  /** Kalanın kırılımı */
  remainingPrincipal: number;
  remainingInterest: number;
  remainingExpenses: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * İki tarih arasındaki TAKVİM günü (b > a ise; değilse 0). Milisaniye farkını
 * 24 saate bölüp tabana yuvarlamak yaz saatinin ileri alındığı ayda bir günü
 * yiyordu (31 gün → 30); gün numaraları UTC'de karşılaştırılır.
 */
function daysBetween(a: Date, b: Date): number {
  const gunA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const gunB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  const gun = Math.round((gunB - gunA) / DAY_MS);
  return gun > 0 ? gun : 0;
}

/** Kuruşa yuvarlar (yarım kuruş yukarı; 1,005 gibi ikili kesir hatası tolere edilir). */
function round2(n: number): number {
  if (!Number.isFinite(n) || n === 0) return 0;
  const isaret = n < 0 ? -1 : 1;
  return (isaret * Math.round(Math.abs(n) * 100 + 1e-7)) / 100;
}

function interestFor(principal: number, annualRatePct: number, days: number): number {
  if (principal <= 0 || annualRatePct <= 0 || days <= 0) return 0;
  return (principal * (annualRatePct / 100) * days) / 365;
}

export function computeKapak(
  file: Pick<
    EnforcementFile,
    'principal' | 'pre_interest' | 'interest_rate' | 'start_date' | 'expenses' | 'attorney_fee'
  >,
  collections: Pick<EnforcementCollection, 'amount' | 'collected_at'>[],
  asOf: Date = new Date()
): KapakResult {
  const rate = Number(file.interest_rate ?? 0);
  let remainingExpenses = Number(file.expenses ?? 0) + Number(file.attorney_fee ?? 0);
  let remainingPrincipal = Number(file.principal ?? 0);
  let accruedPool = Number(file.pre_interest ?? 0); // ödenmemiş birikmiş faiz
  let totalAccrued = 0; // takip sonrası işleyen faiz (raporlama)
  let collected = 0;

  const takipCikisi =
    Number(file.principal ?? 0) + Number(file.pre_interest ?? 0) + Number(file.expenses ?? 0) + Number(file.attorney_fee ?? 0);

  let cursor = new Date(`${file.start_date}T00:00:00`);
  if (Number.isNaN(cursor.getTime())) cursor = new Date(asOf);

  // GELECEK TARİHLİ tahsilat henüz olmamıştır: bugünkü kapaktan düşülmez ve
  // faiz o tarihe kadar işletilmez (eskiden ikisi de oluyordu). Geçersiz
  // tarihli satır da hesaba girmez.
  const gerceklesen = collections.filter((c) => {
    const at = new Date(`${c.collected_at}T00:00:00`).getTime();
    return !Number.isNaN(at) && at <= asOf.getTime();
  });

  const sorted = [...gerceklesen].sort(
    (a, b) => new Date(`${a.collected_at}T00:00:00`).getTime() - new Date(`${b.collected_at}T00:00:00`).getTime()
  );

  for (const c of sorted) {
    const at = new Date(`${c.collected_at}T00:00:00`);
    const segment = round2(interestFor(remainingPrincipal, rate, daysBetween(cursor, at)));
    accruedPool += segment;
    totalAccrued += segment;
    if (at.getTime() > cursor.getTime()) cursor = at;

    // Dağıtım sırası (TBK m.100 ve uygulama): masraf+vekalet → faiz → asıl alacak
    let pay = Number(c.amount ?? 0);
    collected += pay;

    const toExpenses = Math.min(pay, remainingExpenses);
    remainingExpenses -= toExpenses;
    pay -= toExpenses;

    const toInterest = Math.min(pay, accruedPool);
    accruedPool -= toInterest;
    pay -= toInterest;

    const toPrincipal = Math.min(pay, remainingPrincipal);
    remainingPrincipal -= toPrincipal;
    // Kalan (fazla ödeme) varsa borç bitmiştir; artan tutar dağıtılmaz.
  }

  const tail = round2(interestFor(remainingPrincipal, rate, daysBetween(cursor, asOf)));
  accruedPool += tail;
  totalAccrued += tail;

  // Kalemler ayrı yuvarlanır, toplam kalemlerin toplamından çıkar: ekranda
  // kalemler toplama tam eşit olur (eskiden nadiren 1 kuruş farklıydı).
  const kalanAsil = round2(Math.max(0, remainingPrincipal));
  const kalanFaiz = round2(Math.max(0, accruedPool));
  const kalanMasraf = round2(Math.max(0, remainingExpenses));
  return {
    takipCikisi: round2(takipCikisi),
    accruedInterest: round2(totalAccrued),
    collected: round2(collected),
    remaining: round2(kalanAsil + kalanFaiz + kalanMasraf),
    remainingPrincipal: kalanAsil,
    remainingInterest: kalanFaiz,
    remainingExpenses: kalanMasraf,
  };
}
