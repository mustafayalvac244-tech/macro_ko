-- HESAP SİLME TAMAMEN ÇALIŞMIYORDU — Apple'ın ZORUNLU tuttuğu özellik.
--
-- BULUNAN HATA (canlıda uçtan uca ölçüldü). Test kullanıcısı açıldı, 1 müvekkil
-- + 1 dava + 1 duruşma girildi, sonra delete_account çağrıldı:
--     HTTP 403 / 42501
--     "Direct deletion from storage tables is not allowed. Use the Storage API instead."
-- ve silmeden SONRA sayım aynen duruyordu: müvekkil 1, dava 1, duruşma 1,
-- auth kaydı 1, profil 1. Yani kullanıcı "Hesabı Sil" dediğinde HİÇBİR ŞEY
-- silinmiyordu; sadece hata alıyordu.
--
-- SEBEBİ. Supabase, storage.objects üzerine doğrudan SQL DELETE'i engelleyen
-- bir koruma koymuş ("orphaned objects"a karşı). Fonksiyonun İLK ifadesi bu
-- silmeydi; hata fırlatınca işlem geri alınıyor ve İKİNCİ ifade —
-- `delete from auth.users` — HİÇ ÇALIŞMIYOR. Yani asıl silme adımına hiç
-- gelinmiyordu.
--
-- Bu bir platform davranışı değişikliğidir; uygulamanın kodu bir gün çalışıp
-- ertesi gün sessizce çalışmaz hâle gelmiştir. Ekranda "Hesabınız silinemedi"
-- görünür ama sebebi anlaşılmaz.
--
-- ÇÖZÜM. Storage silme fonksiyondan ÇIKARILDI çünkü ZATEN İSTEMCİDE YAPILIYOR:
-- authStore.deleteAccount, RPC'yi çağırmadan ÖNCE documents tablosundan yolları
-- okuyup `supabase.storage.from(...).remove(paths)` ile Storage API üzerinden
-- siliyor — Supabase'in istediği yol tam olarak budur. Fonksiyona kalan tek iş
-- auth.users satırını silmek; geri kalan her şey cascade ile gider
-- (auth.users -> profiles -> 23 tablo, hepsi CASCADE olduğu doğrulandı).
--
-- ARTIK ÖKSÜZ DOSYA KALABİLİR Mİ? İstemcideki Storage API silmesi ağ hatası
-- alırsa evet, birkaç dosya kovada kalabilir. Bunlar erişilemez (kova özel ve
-- sahibi artık yok) ve backup.dosya_envanteri'nde görünür. Alternatifi —
-- silmenin tamamen çalışmaması — kıyaslanamayacak kadar kötüdür.

create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- storage.objects SİLİNMEZ: Supabase doğrudan SQL silmeyi engelliyor ve bu
  -- ifade fonksiyonun tamamını iptal ediyordu. Dosyalar istemcide Storage API
  -- ile, bu çağrıdan ÖNCE siliniyor (bkz. src/store/authStore.ts).
  delete from auth.users where id = auth.uid();
end;
$$;
