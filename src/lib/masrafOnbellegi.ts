import type { QueryClient } from '@tanstack/react-query';

/**
 * DAVA MASRAFI EKLENİNCE/SİLİNİNCE BAYATLAYAN ÖNBELLEKLER (09.10.2026).
 *
 * Aynı masraf satırları (case_expenses) üç yerde sayılıyor: dava detayındaki
 * masraf avansı, müvekkil ekranındaki avans bakiyesi
 * (useClientExpensesTotal) ve ana ekrandaki "avans eksiye düştü" uyarısı
 * (useAdvanceDeficits). Eskiden yalnız ilki tazeleniyordu; müvekkil bakiyesi
 * ve ana ekran uyarısı eski toplamla kalıyordu (natifte odak tazelemesi bağlı
 * değil; ekran yeniden açılmadan ve 60 sn'lik staleTime dolmadan çekilmiyordu).
 */
export function davaMasrafiDegisti(queryClient: QueryClient): void {
  for (const k of ['case-expenses', 'client-expenses-total', 'advance-deficits']) {
    queryClient.invalidateQueries({ queryKey: [k] });
  }
}
