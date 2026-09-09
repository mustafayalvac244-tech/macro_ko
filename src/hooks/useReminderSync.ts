import { useEffect } from 'react';
import { useAllHearings } from '@/hooks/useHearings';
import { useAllDeadlines } from '@/hooks/useDeadlines';
import { useAllPromises } from '@/hooks/usePaymentPromises';
import { useCases } from '@/hooks/useCases';
import { bildirimPlaniYap, type PlanEtkinligi } from '@/utils/bildirimPlani';
import { syncEtkinlikBildirimleri, type PlanKaynak } from '@/lib/notifications';
import { formatMoney } from '@/utils/format';

/**
 * HATIRLATMALARI SUNUCUDAKİ KAYITLARDAN YENİDEN KURAR.
 *
 * NEDEN GEREKLİ. Yerel bildirim CİHAZA aittir; kayıt ise sunucuda durur. Bu üç
 * durumda ikisi ayrışıyordu ve kullanıcı bunu ASLA fark etmiyordu:
 *
 *   • Uygulama silinip yeniden kurulunca — kurulu tüm bildirimler silinir.
 *   • Telefon değişince / ikinci cihazdan girilince — yeni cihazda hiç bildirim
 *     kurulmamıştır, ajanda ise doludur.
 *   • Bildirim izni sonradan verilince — izin yokken kurulan hiçbir kayıt
 *     bildirim üretmemiştir.
 *
 * Üçünde de avukat ajandasında duruşmayı görüyor ve hatırlatmanın kurulu
 * olduğunu sanıyordu. Bu kanca, ana ekran her açıldığında planı sunucudaki
 * kayıtlardan yeniden üretip eksiği tamamlıyor.
 *
 * AYRICA iOS BÜTÇESİNİ UYGULAR: iOS'ta bekleyen bildirim tavanı 64'tür ve
 * fazlası sessizce düşer. Plan, en yakın tarihli bildirimleri önceler
 * (bkz. utils/bildirimPlani.ts) — böylece bütçe dolduğunda düşen her zaman en
 * uzaktaki olur, yarınki duruşma değil.
 */
export function useReminderSync() {
  const hearings = useAllHearings();
  const deadlines = useAllDeadlines();
  const promises = useAllPromises();
  const cases = useCases();

  const h = hearings.dataUpdatedAt;
  const d = deadlines.dataUpdatedAt;
  const p = promises.dataUpdatedAt;
  const c = cases.dataUpdatedAt;

  useEffect(() => {
    // Veri gelmeden eşitleme yapılmaz: boş listeyle çalışmak, kurulu doğru
    // bildirimleri iptal etmek olurdu.
    if (!hearings.data || !deadlines.data) return;

    const davaAdi = new Map((cases.data ?? []).map((k) => [k.id, k.title]));
    const etkinlikler: PlanEtkinligi[] = [];
    const kaynaklar = new Map<string, PlanKaynak>();

    for (const row of hearings.data) {
      etkinlikler.push({
        id: row.id,
        tur: 'durusma',
        anISO: row.scheduled_at,
        secilenDakika: row.reminder_minutes_before,
        bitti: row.is_completed,
      });
      kaynaklar.set(row.id, {
        baslik: row.title,
        altBaslik: (row.case_id && davaAdi.get(row.case_id)) || row.title,
        anISO: row.scheduled_at,
        hearingType: row.type,
      });
    }

    for (const row of deadlines.data) {
      etkinlikler.push({
        id: row.id,
        tur: 'gorev',
        anISO: row.due_at,
        secilenDakika: row.reminder_minutes_before,
        bitti: row.is_completed,
      });
      kaynaklar.set(row.id, {
        baslik: row.title,
        altBaslik: (row.case_id && davaAdi.get(row.case_id)) || row.title,
        anISO: row.due_at,
      });
    }

    // Ödeme sözleri: sorgu zaten yalnız ödenmemişleri getiriyor. Tablo hiç
    // kurulmamış olabilir (isMissingPromiseTable) — o durumda data undefined
    // gelir ve söz hatırlatmaları planın dışında kalır, gerisi çalışır.
    for (const row of promises.data ?? []) {
      // Vade sabahı 09:00 — schedulePromiseReminder ile aynı.
      const anISO = `${row.due_date}T09:00:00`;
      etkinlikler.push({ id: row.id, tur: 'soz', anISO, secilenDakika: 0, bitti: row.is_paid });
      kaynaklar.set(row.id, {
        baslik: row.client?.full_name ?? '',
        altBaslik: formatMoney(row.amount),
        anISO,
      });
    }

    const { plan } = bildirimPlaniYap(etkinlikler, Date.now());
    syncEtkinlikBildirimleri(plan, kaynaklar).catch(() => {});
    // dataUpdatedAt gerçek yeniden çekimleri yakalar; data referansı her
    // render'da değişir ve sonsuz eşitleme doğururdu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [h, d, p, c]);
}
