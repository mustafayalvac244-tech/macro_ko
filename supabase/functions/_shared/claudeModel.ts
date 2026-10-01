// Claude model yetenekleri — içe aktarma YOK (vitest de test edebilsin diye).
//
// UYARLAMALI DÜŞÜNME HER MODELDE YOK — CANLIDA ÖLÇÜLDÜ (01.10.2026 16:26).
// ai-chat her Claude isteğine `thinking: { type: 'adaptive' }` ekliyordu.
// Ücretsiz deneme 28.09'dan beri Haiku 4.5'e gidiyor ve Haiku 4.5 bunu
// desteklemiyor:
//   400 "adaptive thinking is not supported on this model"
// Hata anahtar sorunlarının (önce bakiye, sonra çalışma alanı) arkasında
// görünmüyordu; deneme soruları sessizce yedek modele düşüyordu.
//
// Uyarlamalı düşünme Claude 4.6 ve sonrası modellerde var (Opus/Sonnet 4.6+,
// Opus 5, Sonnet 5…). Haiku, Claude 3 ve 4.0–4.5 sürümlerinde yok.

/** Model `thinking: { type: 'adaptive' }` kabul ediyor mu? */
export function uyarlamaliDusunmeVar(model: string): boolean {
  const m = model.toLowerCase();
  if (m.includes('haiku') || m.includes('claude-3')) return false;
  // claude-sonnet-4-5-…, claude-opus-4-1-…, claude-opus-4-0 (4.0–4.5)
  if (/-4-[0-5](?!\d)/.test(m)) return false;
  // claude-sonnet-4-20250514, claude-opus-4-20250514 (tarihli Claude 4)
  if (/-4-20\d{6}/.test(m)) return false;
  return true;
}
