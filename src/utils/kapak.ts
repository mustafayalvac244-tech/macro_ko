import type { EnforcementCollection, EnforcementFile } from '@/types/database';

/**
 * Güncel kapak hesabı motoru.
 *
 * Basit (adi) faiz, gün bazında işler: asıl alacak × yıllık oran × gün / 365.
 * Tahsilatlar tarihe göre sıralanır; her tahsilat anına kadar biriken faiz
 * hesaplanır ve ödeme İİK 138 sırasıyla düşülür:
 *   1) masraflar + vekalet ücreti  2) birikmiş faiz  3) asıl alacak
 * Kalan asıl alacak azaldıkça sonraki dilimlerde faiz de azalır — avukatın
 * elle yaptığı kapak hesabının birebir karşılığı.
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

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return ms > 0 ? Math.floor(ms / DAY_MS) : 0;
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

  const sorted = [...collections].sort(
    (a, b) => new Date(`${a.collected_at}T00:00:00`).getTime() - new Date(`${b.collected_at}T00:00:00`).getTime()
  );

  for (const c of sorted) {
    const at = new Date(`${c.collected_at}T00:00:00`);
    const segment = interestFor(remainingPrincipal, rate, daysBetween(cursor, at));
    accruedPool += segment;
    totalAccrued += segment;
    if (at.getTime() > cursor.getTime()) cursor = at;

    // İİK 138 dağıtım sırası: masraf+vekalet → faiz → asıl alacak
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

  const tail = interestFor(remainingPrincipal, rate, daysBetween(cursor, asOf));
  accruedPool += tail;
  totalAccrued += tail;

  const remaining = remainingExpenses + accruedPool + remainingPrincipal;

  const round2 = (n: number) => Math.round(n * 100) / 100;
  return {
    takipCikisi: round2(takipCikisi),
    accruedInterest: round2(totalAccrued),
    collected: round2(collected),
    remaining: round2(Math.max(0, remaining)),
    remainingPrincipal: round2(Math.max(0, remainingPrincipal)),
    remainingInterest: round2(Math.max(0, accruedPool)),
    remainingExpenses: round2(Math.max(0, remainingExpenses)),
  };
}
