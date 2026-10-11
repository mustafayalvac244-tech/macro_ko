import { UCRETSIZ_LIMIT } from '@/config/planlar';
import { ucretliPlanAcik } from '@/lib/satinAlma';
import type { DocumentCategory } from '@/types/database';

/**
 * BELGE ARŞİVİ — saf mantık (react-native çekmez; tests/belgeArsivi.test.ts).
 * 10.10.2026 denetimi, 19. alan: ekranlara dağılmış küçük kararlar burada.
 */

/**
 * Belge kategorileri — TEK YERDEN. Arşivin süzgeci kendi listesini tutuyordu ve
 * 'client_photo' (Müvekkil Fotoğrafı) yoktu: yükleme ekranı bu kategoriyi
 * sunuyor, arşivde ise o kategoriyle yüklenen belgeye süzgeçle ulaşmak
 * mümkün değildi.
 */
export const BELGE_KATEGORILERI: DocumentCategory[] = [
  'pleading',
  'contract',
  'evidence',
  'correspondence',
  'court_order',
  'invoice',
  'identification',
  'client_photo',
  'other',
];

export type BelgeSahibi = { tur: 'dava' | 'muvekkil' | 'yok'; ad: string | null };

/**
 * Belge listesinde "bu belge kimin?" etiketi. Müvekkile bağlı belgenin
 * case_id'si boştur; liste onu "Belgelerim" diye gösteriyor, yani hiçbir yere
 * bağlı değilmiş gibi. Dava önde: ikisi birden varsa dava gösterilir.
 */
export function belgeSahibiEtiketi(b: {
  case?: { title: string } | null;
  client?: { full_name: string } | null;
}): BelgeSahibi {
  if (b.case?.title) return { tur: 'dava', ad: b.case.title };
  if (b.client?.full_name) return { tur: 'muvekkil', ad: b.client.full_name };
  return { tur: 'yok', ad: null };
}

/**
 * Depodaki dosya yolu için güvenli ad. Eskiden ASCII dışı her harf '_'
 * oluyordu ("Vekâletname.pdf" → "Vek_letname.pdf"); dosya harici uygulamada
 * açılınca ya da indirilince ad bu bozuk hâliyle görünüyordu. Türkçe harfler
 * en yakın ASCII karşılığına çevrilir (özgün ad `documents.name`de durur).
 */
export function depoDosyaAdi(ad: string): string {
  return ad
    .replace(/ı/g, 'i') // noktasız ı ayrışmaz (NFD'de bileşen yok)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Gerçek boyut. `asset.size` bazı platformlarda boş (0) gelir ve seçici
 * yalan söyleyebilir; dosya okunduktan sonra elde edilen bayt sayısı
 * güvenilir olandır. Okunan boşsa bildirilen kullanılır.
 */
export function gercekDosyaBoyutu(bildirilen: number, okunan: number): number {
  return okunan > 0 ? okunan : bildirilen;
}

/** Boyut, azami sınırı AŞIYOR mu (tam sınır aşmış sayılmaz; 0 = bilinmiyor). */
export function dosyaBoyutuAsildi(boyut: number, azami: number): boolean {
  return boyut > 0 && boyut > azami;
}

/**
 * Ücretsiz planın belge sınırı dolu mu — YALNIZ ön kontrol. Gerçek kısıt
 * veritabanındaki plan_limiti_kontrol tetikleyicisidir (0087) ve sunucunun
 * kuralıyla aynı ölçüyü kullanır (ucretliPlanAcik). Profil ya da sayı
 * bilinmiyorsa ENGELLEMEZ: bilinmeyen bir şeye dayanarak kullanıcıyı
 * durdurmak, sunucunun son sözünden kötüdür.
 */
export function ucretsizBelgeLimitiDolu(
  profil: { is_premium?: boolean | null; ai_tier?: string | null } | null | undefined,
  mevcutBelgeSayisi: number | null | undefined
): boolean {
  if (!profil || mevcutBelgeSayisi == null) return false;
  if (ucretliPlanAcik(profil)) return false;
  return mevcutBelgeSayisi >= UCRETSIZ_LIMIT.belge;
}

/** Ön kontrolün atacağı hata: sunucunun mesajıyla aynı biçim (saveError ayrıştırır). */
export function belgeLimitHatasi(): Error {
  return new Error(`plan_limiti:belge:${UCRETSIZ_LIMIT.belge}`);
}
