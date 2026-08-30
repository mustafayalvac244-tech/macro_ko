/**
 * MÜVEKKİLE BİLGİ VER — dosya durumunu tek dokunuşla paylaşılabilir metne çevirir.
 *
 * Neden: Türkiye'de avukatın en çok vakit kaybettiği iş, müvekkilin "davam ne
 * oldu?" telefonlarıdır. Bilgi zaten uygulamada durur (mahkeme, esas no, sonraki
 * duruşma, aşama) — ama avukat her seferinde elle yazar.
 *
 * Bu modül o bilgiyi resmî ve nazik bir mesaja dönüştürür; avukat WhatsApp/SMS
 * ile gönderir. Uygulama verisi kullanır, AI gerektirmez.
 *
 * İki ilke:
 * 1) ASLA hukuki tahmin/vaat üretmez ("kazanacağız", "yakında biter" demez).
 *    Yalnızca kayıtlı olguları bildirir — yanlış beklenti avukatı zora sokar.
 * 2) Bilinmeyen alan yazılmaz; cümle o bilgi olmadan kurulur.
 */

export interface CaseLike {
  title: string;
  case_number?: string | null;
  court_name?: string | null;
  case_stage?: string | null;
  stage_note?: string | null;
}

export interface HearingLike {
  scheduled_at: string;
  type?: string | null;
  location?: string | null;
  is_completed?: boolean;
}

export interface UpdateInput {
  clientName?: string | null;
  caseItem: CaseLike;
  /** Dosyanın duruşmaları (tamamlanmamış ve gelecekte olan seçilir). */
  hearings?: HearingLike[] | null;
  lawyerName?: string | null;
  firmName?: string | null;
  /** Duruşma türü etiketi için çeviri fonksiyonu (ör. 'Duruşma', 'Keşif'). */
  typeLabel?: (type: string) => string;
  now?: Date;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
}
function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

/** Dosyanın bir sonraki (gelecekteki, tamamlanmamış) duruşmasını bulur. */
export function nextHearing(hearings: HearingLike[] | null | undefined, now: Date = new Date()): HearingLike | null {
  const future = (hearings ?? [])
    .filter((h) => !h.is_completed && new Date(h.scheduled_at) > now)
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  return future[0] ?? null;
}

/**
 * Müvekkile gönderilecek bilgilendirme metnini üretir.
 * Eksik bilgiler sessizce atlanır; uydurma yapılmaz.
 */
export function buildClientUpdate(input: UpdateInput): string {
  const { caseItem, clientName, lawyerName, firmName, typeLabel, now } = input;
  const lines: string[] = [];

  // Hitap
  lines.push(clientName?.trim() ? `Sayın ${clientName.trim()},` : 'Sayın müvekkilimiz,');
  lines.push('');

  // Dosya künyesi — yalnız bilinenler
  const kunye: string[] = [];
  if (caseItem.court_name?.trim()) kunye.push(caseItem.court_name.trim());
  if (caseItem.case_number?.trim()) kunye.push(`${caseItem.case_number.trim()} Esas`);
  lines.push(
    kunye.length
      ? `${kunye.join(' — ')} sayılı dosyanıza ilişkin bilgilendirmedir.`
      : `"${caseItem.title}" konulu dosyanıza ilişkin bilgilendirmedir.`
  );
  lines.push('');

  // Sonraki duruşma
  const nh = nextHearing(input.hearings, now ?? new Date());
  if (nh) {
    const tur = nh.type && typeLabel ? typeLabel(nh.type) : 'Duruşma';
    let s = `${tur.toLocaleUpperCase('tr-TR')}: ${fmtDate(nh.scheduled_at)}, saat ${fmtTime(nh.scheduled_at)}`;
    if (nh.location?.trim()) s += `\nYer: ${nh.location.trim()}`;
    lines.push(s);
    lines.push('');
  }

  // Mevcut aşama / not — avukatın kendi yazdığı bilgi
  if (caseItem.stage_note?.trim()) {
    lines.push(`Son durum: ${caseItem.stage_note.trim()}`);
    lines.push('');
  }

  // Kapanış — vaat YOK
  lines.push('Dosyanızdaki gelişmeler tarafınıza bildirilecektir. Sorularınız için bana ulaşabilirsiniz.');
  lines.push('');
  const imza = ['Saygılarımla'];
  if (lawyerName?.trim()) imza.push(`Av. ${lawyerName.trim().replace(/^av\.?\s+/i, '')}`);
  if (firmName?.trim()) imza.push(firmName.trim());
  lines.push(imza.join('\n'));

  return lines.join('\n');
}
