-- Mevzuatta anlamsal (semantik) arama.
--
-- NEDEN: kelime araması, avukatın günlük diliyle kanunun terimini eşleştiremez.
-- Ölçülen kaçaklar tam olarak bu:
--   "şiddetli geçimsizlik"          → TMK m.166 "evlilik birliğinin temelinden
--                                      sarsılması" (ortak kelime YOK)
--   "en geç kaç yıl içinde dava"    → TBK m.146 "on yıllık zamanaşımı"
--   "ihbar öneli"                   → İşK m.17 "süreli fesih / bildirim süresi"
-- Bu sorularda kelime araması ne kadar iyileştirilse de doğru maddeyi bulamaz;
-- eşleşecek ortak kelime yoktur. Çözüm anlam düzeyinde eşleştirmedir.
--
-- MODEL: Supabase Edge çalışma zamanının YERLEŞİK gte-small modeli (384 boyut).
-- Ücretsizdir, API anahtarı istemez, sunucuda çalışır — "müşteri anahtar
-- girmez" ilkesine ve sıfır maliyet kısıtına uyar. İçtihatta aynı model zaten
-- kullanılıyor (0033) ve orada işe yaradığı ölçüldü.
--
-- SINIRI BİLEREK: gte-small İngilizce ağırlıklıdır, Türkçe hukuk metninde
-- skorları birbirine yakın çıkar. Bu yüzden kelime aramasının YERİNE değil,
-- YANINA konur — içtihatta kurulan hibrit düzenin aynısı.
--
-- SONRADAN ÖLÇÜLDÜ — yukarıdaki üç örneğin YALNIZ BİRİ düzeldi:
--   ✓ "ihbar öneli"          → İşK m.17 bulundu (anlamsal sırada 4.)
--   ✗ "şiddetli geçimsizlik" → TMK m.166 yine bulunamadı. Bu sorguda anlamsal
--     arama tamamen ilgisiz sonuç verdi (TBK m.153 zamanaşımı, CMK m.171 kamu
--     davası) ve skorlar 0,894–0,897 aralığında sıkıştı; yani model bu metinler
--     arasında ayrım YAPAMIYOR.
--   ✗ "kaç yıl içinde dava"  → TBK m.146 yine bulunamadı.
-- Toplam etki: %57,9 → %63,2 (12/19), iki koşuda aynı. Kazanç gerçek ama
-- mütevazı; maliyeti sıfır olduğu için tutuluyor. Türkçe hukuk metnine uygun
-- bir gömme modeli, bu tabloyu asıl değiştirecek adımdır — mevcut model
-- "anlamsal arama var" demeyi hak ediyor ama sorunu çözmüş sayılmaz.

alter table public.mevzuat_maddeleri
  add column if not exists embedding vector(384);

-- HNSW: birkaç bin satırda IVFFlat'ın liste doldurma ihtiyacı yokken de isabetli.
create index if not exists mevzuat_embedding_idx
  on public.mevzuat_maddeleri using hnsw (embedding vector_cosine_ops);

-- Vektörü olmayan maddeleri hızlı bulmak için (toplu doldurma taraması).
create index if not exists mevzuat_embedding_missing_idx
  on public.mevzuat_maddeleri (id) where embedding is null;

create or replace function public.match_mevzuat_semantic(
  q_embedding vector(384),
  match_count integer default 8
)
returns table(
  kanun_short text, kanun_name text, madde_no text, baslik text, snippet text, score real
)
language sql stable security definer set search_path = public as $$
  select m.kanun_short, m.kanun_name, m.madde_no, m.baslik,
         left(m.metin, 600) as snippet,
         (1 - (m.embedding <=> q_embedding))::real as score
  from public.mevzuat_maddeleri m
  where m.embedding is not null
  order by m.embedding <=> q_embedding, m.id
  limit match_count;
$$;

grant execute on function public.match_mevzuat_semantic(vector(384), integer) to authenticated, anon;
