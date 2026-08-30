-- Anlamsal (semantik) içtihat aramasını çalışır hale getirir.
--
-- SORUN: embedding kolonu vector(768) idi (Gemini text-embedding-004 için) ama
-- havuzdaki 1.000+ kararın HİÇBİRİNDE embedding yoktu — çünkü üretimi ücretli
-- bir sağlayıcıya bağlıydı ve o anahtar devrede değildi. Sonuçta
-- match_ictihat_semantic hiç sonuç dönmüyor, AI yalnızca kelime aramasıyla
-- erişebiliyordu. Kelime araması eşanlamı yakalayamaz: avukat "işten atıldım"
-- yazınca kararlardaki "hizmet akdinin feshi" ifadesi eşleşmez.
--
-- ÇÖZÜM: Supabase Edge çalışma zamanının YERLEŞİK modeli (gte-small) kullanılır.
-- Ücretsizdir, API anahtarı istemez, sunucuda çalışır — projenin "müşteri
-- anahtar girmez" ilkesine ve sıfır maliyet kısıtına uyar. Boyutu 384'tür.
--
-- Kolon boş olduğu için tip değişikliğinde veri kaybı yoktur.

drop index if exists ictihat_embedding_idx;
alter table public.ictihat_kararlar drop column if exists embedding;
alter table public.ictihat_kararlar add column embedding vector(384);

-- IVFFlat küçük satır sayısında (birkaç bin) kurulum maliyetine değmez ve
-- listelerin dolması için veri ister; HNSW küçük havuzda da isabetli çalışır.
create index ictihat_embedding_idx
  on public.ictihat_kararlar using hnsw (embedding vector_cosine_ops);

-- Embedding'i olmayan kararları hızlı bulmak için (toplu doldurma taraması).
create index if not exists ictihat_embedding_missing_idx
  on public.ictihat_kararlar (id) where embedding is null;

create or replace function public.match_ictihat_semantic(q_embedding vector(384), match_count integer default 15)
returns table(
  id text, kurul text, daire text, esas_no text, karar_no text,
  karar_tarihi text, durum text, snippet text, score real
)
language sql stable as $$
  select k.id, k.kurul, k.daire, k.esas_no, k.karar_no, k.karar_tarihi, k.durum,
         left(k.full_text, 320) as snippet,
         (1 - (k.embedding <=> q_embedding))::real as score
  from public.ictihat_kararlar k
  where k.embedding is not null
  order by k.embedding <=> q_embedding
  limit match_count;
$$;

grant execute on function public.match_ictihat_semantic(vector(384), integer) to authenticated, anon;
