-- İÇTİHAT ARAMASI "ÖNCE AND" ÖLÇÜMÜ (0111) — yerel tezgâh.
-- ---------------------------------------------------------------------------
-- Ayırt edici kurgu: A tüm terimleri BİRER kez içerir; B tek terimi 60 kez,
-- C tek terimi 40 kez içerir. Eski OR + ts_rank kurgusu B ya da C'yi öne
-- alırdı (terim sıklığı yüksek); 0111 ile tüm terimleri içeren A ilk sırada
-- olmalı, kalan yerler OR yoluyla dolmalı, nadir terimli sorgu da çalışmalı.
insert into public.ictihat_kararlar (id, kurul, daire, esas_no, karar_no, karar_tarihi, durum, arama_terimi, full_text) values
  ('A', 'Yargıtay', '9. HD', '2020/1', '2021/1', '2021-01-01', '', '',
   'İşçinin kıdem tazminatı alacağında zamanaşımı itirazı süresinde ileri sürülmüştür.'),
  ('B', 'Yargıtay', '9. HD', '2020/2', '2021/2', '2021-01-02', '', '',
   repeat('kıdem tazminatı ', 60)),
  ('C', 'Danıştay', '13. D', '2020/3', '2021/3', '2021-01-03', '', '',
   'ihale ' || repeat('zamanaşımı ', 40)),
  ('D', 'Yargıtay', '4. HD', '2020/4', '2021/4', '2021-01-04', '', '',
   'trafik kazası nedeniyle manevi tazminat istemi');

select case
  when (select s.id from public.search_ictihat_fts('kıdem tazminatı zamanaşımı', 3) s limit 1) = 'A'
  then 'GEÇTİ: tüm terimleri içeren karar (A) ilk sırada'
  else 'BOZULDU: ilk sırada ' || coalesce((select s.id from public.search_ictihat_fts('kıdem tazminatı zamanaşımı', 3) s limit 1), 'hiçbir şey')
end;

select case
  when (select count(*) from public.search_ictihat_fts('kıdem tazminatı zamanaşımı', 3)) = 3
  then 'GEÇTİ: kalan yerler OR yoluyla dolduruldu (3/3)'
  else 'BOZULDU: ' || (select count(*) from public.search_ictihat_fts('kıdem tazminatı zamanaşımı', 3)) || ' sonuç döndü (3 bekleniyordu)'
end;

select case
  when (select s.id from public.search_ictihat_fts('trafik kazası', 2) s limit 1) = 'D'
  then 'GEÇTİ: nadir terimli sorgu doğru kararı buluyor (D)'
  else 'BOZULDU: nadir terimli sorgu — ilk sırada ' || coalesce((select s.id from public.search_ictihat_fts('trafik kazası', 2) s limit 1), 'hiçbir şey')
end;

select case
  when (select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'search_ictihat_fts')
  then 'GEÇTİ: fonksiyon SECURITY DEFINER (0106 korundu)'
  else 'BOZULDU: fonksiyon INVOKER''a döndü — 0104 sonrası arama authenticated için kırılır'
end;
