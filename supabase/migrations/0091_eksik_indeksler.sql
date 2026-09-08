-- EKSİK İNDEKSLER: RLS süzgeçleri ve cascade silme için.
--
-- BULUNAN DURUM (ölçüldü). owner_id kolonu olan 18 tablonun 7'sinde bu kolonun
-- indeksi yoktu; ayrıca 11 yabancı anahtar indekssizdi. Tablolar bugün
-- neredeyse boş (0–4 satır), yani ŞU AN bir yavaşlık YOK — bu bir performans
-- düzeltmesi değil, veri büyümeden önce alınan bir önlem.
--
-- NEDEN ÖNEMLİ:
--
-- 1) RLS HER SORGUDA SÜZÜYOR. Her politikanın koşulu owner_id = auth.uid();
--    indeks yoksa her okuma sıralı tarama yapar ve tablo büyüdükçe TÜM
--    kullanıcılar için yavaşlar (kendi satırınız 5 tane olsa bile tarama
--    herkesin satırları üzerinde gezer).
--
-- 2) HESAP SİLME CASCADE İLE GEZİYOR. delete_account (Apple'ın zorunlu
--    tuttuğu özellik) auth.users'tan başlayıp bu tablolara kadar cascade
--    ediyor. İndekssiz yabancı anahtarda Postgres, silinen her satır için
--    çocuk tabloyu baştan sona tarar. Veri büyüdüğünde hesap silme yavaşlar
--    ve zaman aşımına düşebilir — kullanıcı "hesabımı silemiyorum" der.
--
-- MALİYET: tablolar boş olduğu için indeks başına ~8 kB, toplam ~90 kB.
-- Veritabanı 500 MB sınırının 422 MB'ındayken bu ölçülemeyecek kadar küçük.

create index if not exists case_expenses_owner_idx on public.case_expenses (owner_id);
create index if not exists case_installments_owner_idx on public.case_installments (owner_id);
create index if not exists client_advances_owner_idx on public.client_advances (owner_id);
create index if not exists client_expenses_owner_idx on public.client_expenses (owner_id);
create index if not exists enforcement_collections_owner_idx on public.enforcement_collections (owner_id);
create index if not exists jobs_owner_idx on public.jobs (owner_id);
create index if not exists offices_owner_idx on public.offices (owner_id);

-- Kalan indekssiz yabancı anahtarlar (cascade silme ve join için).
create index if not exists ai_odeme_user_idx on public.ai_odeme (user_id);
create index if not exists documents_client_idx on public.documents (client_id);
create index if not exists office_messages_sender_idx on public.office_messages (sender_id);
create index if not exists payment_promises_case_idx on public.payment_promises (case_id);
