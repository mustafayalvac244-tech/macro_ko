-- 04.10.2026 — İSTEK ADIM SÜRELERİ (bkz. supabase/functions/_shared/adimSure.ts).
--
-- Avukat eleştirisi "yavaş". Sohbetin ~20 sn'si modelin dışında geçiyor ama
-- nerede olduğu ölçülemiyordu. Her istek için:
--   sure_ms      istek başından kayda kadar toplam
--   model_bas_ms istek başından ilk model çağrısına kadar (arama + hazırlık)
--   model_ms     model çağrılarında geçen toplam
-- Kalan = sure_ms - model_bas_ms - model_ms → denetim (canlı künye teyidi) + kayıt.
-- Soru metni yine SAKLANMAZ; yalnız süre.
alter table public.ai_istek
  add column if not exists sure_ms integer,
  add column if not exists model_bas_ms integer,
  add column if not exists model_ms integer;
