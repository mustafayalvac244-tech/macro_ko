import { supabase } from '@/lib/supabase';
import { duzeltmeOrani } from '@/lib/duzeltmeOlcusu';

/**
 * AVUKATIN DÜZELTMESİNİ ÖLÇ — METNİ SAKLAMADAN.
 *
 * NEDEN VAR. `DuzenlenebilirCikti` avukatın taslağı düzenlemesine izin veriyor
 * ve ekranda "düzenlendi" diye işaretliyordu — ama o bilgi hiçbir yere
 * yazılmıyordu. Sahip olabileceğimiz en değerli sinyal (gerçek avukatın,
 * gerçek dosyada, gerçek düzeltmesi) her seferinde çöpe gidiyordu.
 *
 * NE GÖNDERİLİR: mod, model, iki uzunluk, değişim oranı.
 * NE GÖNDERİLMEZ: metnin kendisi, düzeltmenin kendisi, herhangi bir fark.
 *
 * Taslak metni avukatın MÜVEKKİLİNE ait kişisel veri içerir — veri sahibi
 * bizim kullanıcımız bile değil, üçüncü kişi. Onu "ürün geliştirme" amacıyla
 * saklamak aydınlatma metnimizde olmayan yeni bir işleme amacı açar ve
 * KVKK_SURUM artırıp herkesten yeniden rıza almayı gerektirir.
 * (Gerekçe ve sıra: supabase/migrations/0142_ai_cikti_geri_bildirim.sql)
 *
 * SESSİZ BAŞARISIZLIK BİLEREK. Ölçüm kaydı kullanıcının işini hiçbir koşulda
 * bölmemeli: ağ yoksa, tablo yoksa, RLS reddederse avukat bunu GÖRMEZ.
 * Ölçüm uğruna ürünü bozmak, ölçümsüz kalmaktan kötüdür. Hata yalnız
 * geliştirme kaydına düşer.
 */
export async function ciktiDuzeltmesiniBildir(girdi: {
  mod: string;
  model?: string | null;
  istekId?: string | null;
  asil: string;
  son: string;
}): Promise<void> {
  try {
    const { data: oturum } = await supabase.auth.getUser();
    const uid = oturum?.user?.id;
    if (!uid) return;

    const duzenlendi = girdi.asil !== girdi.son;

    await supabase.from('ai_cikti_geri_bildirim').insert({
      owner_id: uid,
      istek_id: girdi.istekId ?? null,
      mod: girdi.mod,
      model: girdi.model ?? null,
      asil_uzunluk: girdi.asil.length,
      son_uzunluk: girdi.son.length,
      degisen_oran: duzeltmeOrani(girdi.asil, girdi.son),
      duzenlendi,
    });
  } catch {
    // Bilerek yutuluyor — yukarıdaki "sessiz başarısızlık" gerekçesi.
  }
}
