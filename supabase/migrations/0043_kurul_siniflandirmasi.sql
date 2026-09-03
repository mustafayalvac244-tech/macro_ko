-- İçtihat havuzunda KURUL sınıflandırmasının düzeltilmesi.
--
-- İKİ AYRI HATA ÖLÇÜLDÜ (4.015 kararın 411'i, yani %10'u yanlış):
--
-- 1) YANLIŞ MERCİ (23 karar). ictihat işlevindeki kurulOf(), kurulu kararın
--    GELDİĞİ KAYNAĞA göre belirliyordu: canlı UYAP Emsal yolundan gelen her
--    karara "BAM/Yerel" diyordu. Sonuç: daire adı açıkça "Yargıtay 1. Ceza
--    Dairesi" olan 14 karar havuza BAM/Yerel olarak yazıldı. Kaynak, kararın
--    hangi mercie ait olduğunu söylemez — daire adı söyler.
--
-- 2) ANLAMSIZ ETİKET (383 karar). Yerel mahkeme kararları (Asliye Ticaret,
--    Asliye Hukuk...) "Diğer" kovasına atılıyordu. Bunlar tanımsız değil,
--    YEREL mahkeme kararları; "Diğer" demek bilgiyi saklıyor.
--
-- KÖK SEBEP: üç kod yolu (Node hasatçısı, harvest-tick, ictihat işlevi) aynı
-- işi üç farklı şekilde yapıyordu ve ikisi farklı yedek etiket üretiyordu
-- ("Diğer" ve "BAM/Yerel"). Aynı havuzda iki ayrı çöp kova oluşmuştu.
-- Üç yol da tek kurala getirildi; bu göç geçmiş kayıtları düzeltir.
--
-- NEDEN ÖNEMLİ: kurul, kararın ağırlığını gösterir. Avukat için Yargıtay
-- kararı (yerleşik içtihat) ile yerel mahkeme kararı aynı şey değildir;
-- yanlış etiket, kaynağın değerini yanlış gösterir.

update public.ictihat_kararlar
set kurul = case
  when lower(coalesce(daire,'')) like '%bölge adliye%' then 'BAM'
  when lower(coalesce(daire,'')) like '%bölge idare%'  then 'BİM'
  when lower(coalesce(daire,'')) like '%danıştay%'     then 'Danıştay'
  when lower(coalesce(daire,'')) like '%yargıtay%'     then 'Yargıtay'
  when lower(coalesce(daire,'')) like '%anayasa%'      then 'AYM'
  else 'Yerel'
end
where kurul is distinct from case
  when lower(coalesce(daire,'')) like '%bölge adliye%' then 'BAM'
  when lower(coalesce(daire,'')) like '%bölge idare%'  then 'BİM'
  when lower(coalesce(daire,'')) like '%danıştay%'     then 'Danıştay'
  when lower(coalesce(daire,'')) like '%yargıtay%'     then 'Yargıtay'
  when lower(coalesce(daire,'')) like '%anayasa%'      then 'AYM'
  else 'Yerel'
end;
