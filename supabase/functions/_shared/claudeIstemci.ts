// Claude istemcisi — ÇALIŞMA ALANINA BAĞLI OLMAYAN ANAHTAR DESTEĞİ.
//
// NEDEN (canlıda ölçüldü, 30.09–01.10.2026). Anthropic kişisel (identity-linked)
// anahtar veriyor. Anahtar oluşturulurken bir çalışma alanı SEÇİLMEZSE her
// istek `anthropic-workspace-id` başlığı ister; yoksa 400 döner:
//   "This API key is not scoped to a workspace, so this request must include
//    the anthropic-workspace-id header…"
// 30.09'da yüklenen anahtar böyle; Claude'a giden her istek düştü, deneme
// soruları yedek modele kaydı.
//
// KİMLİK OTOMATİK BULUNAMIYOR — ÖLÇÜLDÜ (01.10.2026 16:21). Belgeye göre böyle
// bir anahtar Admin API'yi çağırabilir; denendi: /v1/organizations/workspaces
// ve /api_keys ikisi de 403 "Missing permissions". Arama kodu bu yüzden
// kaldırıldı (her soğuk başlangıçta boşa iki istek atıyordu).
//
// ŞİMDİKİ YOL. Başlık YALNIZ bu 400 geldiğinde eklenir ve istek bir kez
// yeniden denenir. Çalışma alanına bağlı (scoped) bir anahtara başlık hiç
// gönderilmez — yanlış alan kimliği o anahtarı bozabilirdi.
// Kimlik sırası: ANTHROPIC_WORKSPACE_ID ortam değişkeni → CALISMA_ALANI sabiti.
// Kimlik bir SIR DEĞİLDİR (wrkspc_… bir tanımlayıcı); depoda durabilir.
import Anthropic from 'npm:@anthropic-ai/sdk@0.124.0';

// SDK tipleri tsc'de çözülmüyor (deno-shim: 'npm:*' tipsiz modül); istemci
// tipi bu yüzden SDK'nın kendisinden türetilir ve çağıran yerlerdeki gibi gevşek kalır.
type Istemci = InstanceType<typeof Anthropic>;

/** Ürün sahibinin Claude Console'daki çalışma alanı (Settings → Workspaces). */
export const CALISMA_ALANI = '';

/** 400 "anthropic-workspace-id … required" hatası mı? */
export function calismaAlaniHatasiMi(e: unknown): boolean {
  return /anthropic-workspace-id/i.test(String((e as Error)?.message ?? ''));
}

function calismaAlani(): string {
  return (Deno.env.get('ANTHROPIC_WORKSPACE_ID') || CALISMA_ALANI).trim();
}

/**
 * İsteği koşar; "çalışma alanı gerekli" 400'ünde kimlik biliniyorsa başlığı
 * ekleyip BİR KEZ yeniden dener. Diğer her hata olduğu gibi yukarı çıkar.
 */
// Dönüş tipi `any`: SDK yanıtı zaten tipsiz geliyor (bkz. Istemci); çağıran
// yerler yanıtı eskisi gibi yapısal olarak okur.
// deno-lint-ignore no-explicit-any
export async function claudeIle(apiKey: string, is: (istemci: Istemci) => Promise<any>): Promise<any> {
  try {
    return await is(new Anthropic({ apiKey }));
  } catch (e) {
    const alan = calismaAlani();
    if (!calismaAlaniHatasiMi(e) || !alan) throw e;
    return await is(new Anthropic({ apiKey, defaultHeaders: { 'anthropic-workspace-id': alan } }));
  }
}
