-- KARAR (İÇTİHAT) ATFI DENETİMİ — havuzda var mı?
--
-- NEDEN. Madde atfı denetimi (0062) aylardır çalışıyor. Karar atfında hiçbir
-- denetim yoktu. Oysa avukat için en pahalı uydurma türü budur:
--
--   "Yargıtay 9. HD, 2019/12345 E., 2020/6789 K."
--
-- Gerçek görünür — daire var, numara biçimce doğru, yıllar tutarlı. Dilekçeye
-- girer; ilk fark eden karşı vekil olur.
--
-- BU FONKSİYON "UYDURMA" DEMEZ, "BULDUM" DER. Fark kritiktir: havuzumuzda
-- ~11 bin karar var, Yargıtay milyonlarca karar verdi. Bir atfı bulamamak
-- BİZİM eksiğimizdir, atfın yanlışlığı değil. Bu yüzden fonksiyon yalnız
-- EŞLEŞENLERİ döner; eşleşmeyen için ekranda "havuzda yok, teyit ediniz"
-- yazılır — "uydurma" değil.
--
-- Kesin konuşabildiğimiz yer ayrı ve havuzdan bağımsızdır (bkz.
-- _shared/kararAtif.ts → tutarsizKararlar): karar yılı esas yılından önce
-- olamaz, gelecek yıl numarası verilemez, 47. Hukuk Dairesi hiç var olmadı.
-- Orada aritmetik konuşur, korpus değil.
--
-- EŞLEŞME BİÇİMDEN BAĞIMSIZ. Havuzda esas/karar numaraları "2019/12345"
-- biçiminde ama arada boşluk ("2019 / 12345") ya da farklı tire kullanılmış
-- satırlar olabilir; iki taraf da aynı sadeleştirmeden geçirilir. Aksi hâlde
-- GERÇEKTEN havuzda olan bir kararı "bulunamadı" diye gösterirdik — yani
-- denetimin güvenilirliğini kendi biçim gürültümüzle düşürürdük.

create or replace function public.karar_atfi_sade(v text)
returns text
language sql
immutable
parallel safe as $$
  select nullif(regexp_replace(translate(coalesce(v, ''), '–—', '--'), '\s+', '', 'g'), '');
$$;

comment on function public.karar_atfi_sade(text) is
  'Esas/karar numarasını karşılaştırılabilir tek biçime indirger (boşluk atılır, uzun tire kısa tireye çevrilir).';

/*
 * Verilen atıflardan HAVUZDA BULUNANLARI döner.
 *
 * Girdi: [{"esas": "2019/12345", "karar": "2020/6789"}, ...]
 * Çıktı: eşleşen atıf + bulunan kararın kimliği (ekranda karara götürmek için).
 *
 * EŞLEŞME KURALI. Esas ve karar birlikte verilmişse İKİSİ de tutmalıdır:
 * yalnız esas tutup kararı tutmayan bir satır, aynı dosyada verilmiş BAŞKA
 * bir karardır ve avukata "doğrulandı" demek yanıltıcı olur. Yalnız esas
 * verilmişse esas üzerinden eşleşir.
 */
create or replace function public.havuzdaki_kararlar(atiflar jsonb)
returns table(esas text, karar text, karar_id text, daire text, karar_tarihi text)
language sql
stable
security definer set search_path = public as $$
  select distinct on (a.esas, a.karar)
         a.esas, a.karar, k.id, k.daire, k.karar_tarihi::text
  from jsonb_to_recordset(coalesce(atiflar, '[]'::jsonb)) as a(esas text, karar text)
  join public.ictihat_kararlar k
    on (
         nullif(a.esas, '') is null
         or public.karar_atfi_sade(k.esas_no) = public.karar_atfi_sade(a.esas)
       )
   and (
         nullif(a.karar, '') is null
         or public.karar_atfi_sade(k.karar_no) = public.karar_atfi_sade(a.karar)
       )
  where nullif(a.esas, '') is not null or nullif(a.karar, '') is not null
  -- DISTINCT ON'un hangi satırı seçtiği ORDER BY olmadan belirsizdir. Aynı
  -- esas/karar çiftine birden çok satır düşerse (mükerrer hasat) en yeni
  -- tarihli seçilsin ki ekranda gösterilen künye kararsız olmasın.
  order by a.esas, a.karar, k.karar_tarihi desc nulls last, k.id;
$$;

comment on function public.havuzdaki_kararlar(jsonb) is
  'Yapay zekâ çıktısındaki içtihat atıflarından havuzda BULUNANLARI döner. Bulunmayan atıf "uydurma" demek değildir — havuz eksik olabilir.';

-- ── YETKİ: YALNIZ service_role ──────────────────────────────────────────────
--
-- İlk yazdığımda buraya `to authenticated, anon` koymuştum; YANLIŞTI ve
-- 0107'nin kapattığı deliği geri açardı. `havuzdaki_kararlar` doğrudan
-- `ictihat_kararlar`ı okuyor ve SECURITY DEFINER olduğu için RLS'i baypas
-- ediyor: anon'a açmak, korpusu jsonb listesi göndererek sorgulanabilir hâle
-- getirirdi. 0062'nin aynı hatası 0079'da temizlenmişti.
--
-- PUBLIC'TEN DE ALINMALI: Postgres yeni fonksiyona varsayılan olarak PUBLIC'e
-- EXECUTE verir ve anon yetkiyi oradan alır; yalnız "from anon" demek hiçbir
-- şey yapmaz (0106'da bu tuzağa düşüldü).
--
-- Denetimi çağıran ai-chat uç işlevi servis anahtarını kullanıyor; istemcinin
-- bu fonksiyonu doğrudan çağırmasına gerek yok.
revoke all on function public.havuzdaki_kararlar(jsonb) from public, anon, authenticated;
grant execute on function public.havuzdaki_kararlar(jsonb) to service_role;

-- karar_atfi_sade saf metin işler, veri okumaz; yine de gereksiz yere açık
-- bırakmıyoruz (indeks tanımında kullanılıyor, çağrılması gerekmiyor).
revoke all on function public.karar_atfi_sade(text) from public, anon, authenticated;
grant execute on function public.karar_atfi_sade(text) to service_role;

-- Denetim HER yapay zekâ isteğinde çalışacak. Sadeleştirilmiş numara üzerinden
-- arandığı için ham sütun indeksi işe yaramaz; ifade indeksi şart.
create index if not exists ictihat_kararlar_esas_sade_idx
  on public.ictihat_kararlar (public.karar_atfi_sade(esas_no));
create index if not exists ictihat_kararlar_karar_sade_idx
  on public.ictihat_kararlar (public.karar_atfi_sade(karar_no));
