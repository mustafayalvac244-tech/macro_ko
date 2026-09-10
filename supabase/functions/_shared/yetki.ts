// BAKIM UÇLARININ YETKİ KONTROLÜ — tek kaynak.
// ---------------------------------------------------------------------------
// NEDEN VAR. embed-ictihat ve harvest-tick uçlarında HİÇBİR yetki kontrolü
// yoktu; tek koruma ağ geçidinin "verify_jwt" ayarıydı ve o yalnızca "geçerli
// BİR JWT var mı" diye bakar, KİMİN olduğuna bakmaz. Yani uygulamaya kayıtlı
// HERHANGİ bir avukat bu bakım uçlarını tetikleyebiliyordu:
//   • harvest-tick → UYAP/Bedesten'e (devlet sistemleri) bizim IP'mizden
//     tekrar tekrar istek attırmak,
//   • embed-ictihat → gömme modelini boşa çalıştırıp ortak semantik arama
//     indeksine yazdırmak.
//
// NEDEN "ANAHTARI KARŞILAŞTIR" DEĞİL. İlk yazılan sürüm, gelen jetonu
// SUPABASE_SERVICE_ROLE_KEY ortam değişkeniyle birebir karşılaştırıyordu.
// CANLI TESTTE BU YANLIŞ ÇIKTI: bu projede İKİ ayrı anahtar biçimi bir arada
// yaşıyor — eski JWT biçimi (219 karakter) ve yeni sb_secret_... biçimi (41
// karakter). Zamanlanmış hasat işi (cron → hasat_tetikle → net.http_post)
// Vault'taki ESKİ JWT'yi gönderiyor; ortam değişkeni ise farklı bir biçim
// taşıyor. Yani o karşılaştırma, 20 dakikada bir çalışan içtihat hasadını
// SESSİZCE BOZARDI (gerçek çağrıyla doğrulandı: servis anahtarı 403 aldı).
//
// İKİNCİ DENEME DE ELENDİ (canlı testte): "politikası olmayan bir tabloyu
// okumayı dene" yaklaşımı YANLIŞTI — RLS satırları FİLTRELER, hata döndürmez.
// Anon anahtarıyla sorgu hatasız ama BOŞ döndü ve kontrol onu yetkili saydı;
// gerçek çağrıda anon anahtarı ucu tetikleyebildi (HTTP 200).
//
// YÖNTEM (çalışan sürüm): yalnız service_role'ün ÇALIŞTIRABİLDİĞİ, yan etkisiz
// bir fonksiyonu (public.servis_yetki_kontrol — bkz. migration 0081) çağırırız.
// Yetkisiz çağrıda Postgres NET BİR HATA verir (42501), boş sonuç değil — yani
// "filtrelendi mi, yetkisiz mi" belirsizliği yoktur. İmzayı da Postgres/
// PostgREST doğrular; ağ geçidinin verify_jwt ayarından bağımsızdır.
import { createClient } from 'npm:@supabase/supabase-js@2';

/** İstek gerçekten servis yetkisi taşıyor mu? Bakım uçları için ZORUNLU. */
export async function servisYetkisiVarMi(req: Request): Promise<boolean> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  // Doğrulayamıyorsak AÇIK KAPI BIRAKMAYIZ: reddederiz.
  if (!token || !url) return false;
  try {
    const c = createClient(url, token, { auth: { persistSession: false } });
    const { data, error } = await c.rpc('servis_yetki_kontrol');
    return !error && data === true;
  } catch {
    return false;
  }
}
