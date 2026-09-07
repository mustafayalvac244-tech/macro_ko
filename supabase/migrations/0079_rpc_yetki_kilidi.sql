-- KRİTİK: PARA VE KOTA FONKSİYONLARI HERKESE AÇIKTI.
--
-- BULUNAN AÇIK (canlıda GERÇEK sömürüyle doğrulandı). Postgres'te bir fonksiyon
-- oluşturulduğunda EXECUTE yetkisi VARSAYILAN OLARAK PUBLIC'e verilir. Bu
-- projedeki SECURITY DEFINER fonksiyonların çoğunda sonradan
-- "grant execute ... to service_role" yazılmış ama VARSAYILAN PUBLIC YETKİSİ
-- HİÇ KALDIRILMAMIŞ. Sonuç: bu fonksiyonlar PostgREST üzerinden herhangi bir
-- giriş yapmış kullanıcı (hatta anon) tarafından doğrudan çağrılabiliyordu ve
-- SECURITY DEFINER oldukları için RLS'i de baypas ederek çalışıyorlardı.
--
-- CANLI KANIT (düzeltmeden önce): demo hesabının KENDİ oturumuyla (yalnız anon
-- key + kendi JWT'si, servis anahtarı YOK)
--     POST /rest/v1/rpc/ai_kontor_yukle {"p_user":"<kendi id>","p_tutar":999999}
-- çağrıldı → HTTP 200, bakiye 999.999 TL oldu. Yani herhangi bir kullanıcı
-- kendine sınırsız ücretli AI kredisi verebiliyordu; fatura bize gelirdi.
-- Test bakiyesi hemen silindi.
--
-- AYNI SINIFTAN DİĞER SÖMÜRÜLER (aynı sebep, aynı düzeltme):
--   • revenuecat_olay_isle → kendine bedava 1.999₺'lik "ai" aboneliği vermek
--   • ai_mod_serbest_birak → aylık 250 soru kotasını sıfırlayıp sınırsız kullanım
--   • deneme_hakki_serbest_birak → 3 soruluk deneme hakkını sonsuz yenilemek
--   • ai_istek_iade / ai_odeme_isle → sahte iade/ödeme ile bedava kontör
--   • ai_kontor_dus → BAŞKA bir kullanıcının bakiyesini sıfırlamak (zarar verme)
--
-- ÇÖZÜM: bu fonksiyonlarda PUBLIC/anon/authenticated yetkisini tamamen kaldır,
-- yalnız service_role'e bırak. Bunları zaten SADECE uç işlevleri (edge
-- functions) servis anahtarıyla çağırıyor — istemcinin doğrudan çağırdığı RPC
-- listesi kod taramasıyla çıkarıldı (my_profile, delete_account,
-- public_profiles, search_lawyers, admin_*) ve BU LİSTEYE DOKUNULMUYOR.
--
-- Not: imza yazım hatası riskini sıfırlamak için isimden döngüyle gidiliyor —
-- aşırı yükleme (overload) varsa hepsi kapsanır.
do $$
declare
  fn record;
  hedefler text[] := array[
    -- para
    'ai_kontor_yukle', 'ai_kontor_dus', 'ai_odeme_isle', 'ai_istek_iade',
    'revenuecat_olay_isle',
    -- kota / deneme hakkı
    'ai_mod_rezerve_et', 'ai_mod_serbest_birak', 'ai_mod_sayaci',
    'deneme_hakki_rezerve_et', 'deneme_hakki_serbest_birak',
    -- bakım / ETL / iç kullanım (istemcinin çağırmasına gerek yok)
    'ai_durum_yaz', 'ictihat_atif_cikar', 'kural_atiflarini_tazele',
    'madde_baglam_tazele', 'uydurma_maddeler',
    -- tetikleyici gövdeleri (tetikleyici olarak çalışırlar; doğrudan
    -- çağrılabilir olmalarının hiçbir meşru sebebi yok)
    'handle_new_user', 'protect_profile_privileges', 'ictihat_atif_trg'
  ];
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any(hedefler)
  loop
    execute format('revoke all on function %s from public, anon, authenticated', fn.sig);
    execute format('grant execute on function %s to service_role', fn.sig);
  end loop;
end $$;
