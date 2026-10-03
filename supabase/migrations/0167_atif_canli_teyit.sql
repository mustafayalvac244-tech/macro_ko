-- 03.10.2026 — CANLI KÜNYE TEYİDİ sayaçları (bkz. ai-chat > kararAtfiDenetimi,
-- _shared/uyapCanli.ts > canliKunyeDogrula).
--
-- OLAY: gerçek kullanıcı dilekçeye içtihat istedi; model iki künye yazdı, ikisi
-- de havuzda yoktu, avukat UYAP'ta da bulamadı. Artık havuzda olmayan Yargıtay
-- künyesi canlı kaynakta aranıyor. Bu iki sayı, "canlı teyit ne kadar işe
-- yarıyor" sorusunu ölçümle cevaplar. Kişi ve metin yok (0118 ile aynı ilke).
alter table public.atif_denetim_kaydi
  add column if not exists canli_dogrulanan integer not null default 0,
  add column if not exists canlida_yok integer not null default 0;
