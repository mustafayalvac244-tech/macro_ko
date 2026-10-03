-- 03.10.2026 — ÖNBELLEK ÖLÇÜMÜ (bkz. _shared/onbellek.ts, _shared/fiyat.ts > faturaGirdi).
--
-- Sohbet geçmişi artık önbelleğe alınıyor ve maliyet önbellek fiyatıyla
-- hesaplanıyor (okunan 0,1, yazılan 1,25 kat). Bu iki sütun "önbellek ne kadar
-- tuttu" sorusunu ölçümle cevaplar.
--
-- DİKKAT — tokens_in'in ANLAMI 03.10.2026'dan itibaren Claude çağrılarında
-- "tam fiyat eşdeğeri girdi"dir (ham girdi değil). Ham girdi:
--   tokens_in - 0,1*onbellek_okunan - 1,25*onbellek_yazilan + onbellek_okunan + onbellek_yazilan
-- Önceki satırlarda önbellek dahil ham toplam tam fiyattan sayılmıştı.
alter table public.ai_istek
  add column if not exists onbellek_okunan integer not null default 0,
  add column if not exists onbellek_yazilan integer not null default 0;
