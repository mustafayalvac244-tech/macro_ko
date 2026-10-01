// Claude istemcisi — ÇALIŞMA ALANI (workspace) KİMLİĞİ KENDİLİĞİNDEN BULUNUR.
//
// NEDEN (01.10.2026, canlıda ölçüldü). Anthropic artık kişisel (identity-linked)
// anahtarlar veriyor. Anahtar oluşturulurken bir çalışma alanı SEÇİLMEZSE her
// istek `anthropic-workspace-id` başlığı ister; yoksa 400 döner:
//   "This API key is not scoped to a workspace, so this request must include
//    the anthropic-workspace-id header…"
// 30.09'da yüklenen anahtar böyleydi; Claude'a giden her istek düştü, ücretsiz
// deneme soruları yedek modele kaydı.
//
// ÇÖZÜM. Belge (platform.claude.com › Workspaces): çalışma alanına bağlı OLMAYAN
// kişisel anahtar Admin API'yi çağırabilir. İlk 400'de:
//   1. /v1/organizations/workspaces → adı olan (Varsayılan DIŞI) alanlar.
//   2. /v1/organizations/api_keys → anahtarların `scope` alanı; Varsayılan
//      alana bağlı bir anahtarın scope'u Varsayılan'ın GERÇEK kimliğini taşır.
//   Listede olmayan kimlik = Varsayılan. Bulunamazsa "Claude Code" dışındaki ilk
//   alan (Claude Code alanı uygulama trafiği için değil).
// Bulunan kimlik süreç belleğinde tutulur (soğuk başlangıçta bir kez aranır).
// ANTHROPIC_WORKSPACE_ID ortam değişkeni verilirse arama hiç yapılmaz.
//
// Kimlik bir SIR DEĞİLDİR (wrkspc_… bir tanımlayıcı); kayda yazılabilir.
import Anthropic from 'npm:@anthropic-ai/sdk@0.124.0';

const API = 'https://api.anthropic.com';
// SDK tipleri tsc'de çözülmüyor (deno-shim: 'npm:*' tipsiz modül); istemci
// tipi bu yüzden SDK'nın kendisinden türetilir ve çağıran yerlerdeki gibi gevşek kalır.
type Istemci = InstanceType<typeof Anthropic>;
let kesfedilen: string | null | undefined;

/** 400 "anthropic-workspace-id … required" hatası mı? */
export function calismaAlaniHatasiMi(e: unknown): boolean {
  return /anthropic-workspace-id/i.test(String((e as Error)?.message ?? ''));
}

async function jsonAl(yol: string, apiKey: string): Promise<unknown> {
  const r = await fetch(`${API}${yol}`, {
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
  });
  return r.ok ? await r.json() : null;
}

/** Çalışma alanı kimliğini bulur; bulamazsa null. Sonuç süreç boyunca saklanır. */
export async function calismaAlaniKesfet(apiKey: string): Promise<string | null> {
  if (kesfedilen !== undefined) return kesfedilen;
  try {
    const [alanlar, anahtarlar] = await Promise.all([
      jsonAl('/v1/organizations/workspaces?limit=100&include_archived=false', apiKey),
      jsonAl('/v1/organizations/api_keys?limit=100', apiKey),
    ]);
    const liste = ((alanlar as { data?: Array<{ id: string; name?: string }> } | null)?.data ?? []);
    const adli = new Set(liste.map((w) => w.id));
    const anahtarAlanlari = new Set(JSON.stringify(anahtarlar ?? {}).match(/wrkspc_[A-Za-z0-9]+/g) ?? []);
    const varsayilan = [...anahtarAlanlari].find((id) => !adli.has(id));
    const yedek = liste.find((w) => !/claude\s*code/i.test(w.name ?? ''))?.id;
    kesfedilen = varsayilan ?? yedek ?? null;
    console.log(`claude çalışma alanı: ${kesfedilen ?? 'BULUNAMADI'} (varsayılan=${!!varsayilan}, adli=${adli.size}, anahtar=${anahtarAlanlari.size})`);
  } catch (e) {
    console.error('claude çalışma alanı aranamadı:', String(e).slice(0, 120));
    kesfedilen = null;
  }
  return kesfedilen;
}

export function claudeIstemci(apiKey: string): Istemci {
  const alan = Deno.env.get('ANTHROPIC_WORKSPACE_ID') || kesfedilen || undefined;
  return new Anthropic(alan ? { apiKey, defaultHeaders: { 'anthropic-workspace-id': alan } } : { apiKey });
}

/**
 * İsteği koşar; "çalışma alanı gerekli" 400'ünde kimliği bulup BİR KEZ yeniden
 * dener. Diğer her hata olduğu gibi yukarı çıkar.
 */
// Dönüş tipi `any`: SDK yanıtı zaten tipsiz geliyor (bkz. Istemci); çağıran
// yerler yanıtı eskisi gibi yapısal olarak okur.
// deno-lint-ignore no-explicit-any
export async function claudeIle(apiKey: string, is: (istemci: Istemci) => Promise<any>): Promise<any> {
  try {
    return await is(claudeIstemci(apiKey));
  } catch (e) {
    if (!calismaAlaniHatasiMi(e) || Deno.env.get('ANTHROPIC_WORKSPACE_ID') || kesfedilen) throw e;
    const alan = await calismaAlaniKesfet(apiKey);
    if (!alan) throw e;
    return await is(claudeIstemci(apiKey));
  }
}
