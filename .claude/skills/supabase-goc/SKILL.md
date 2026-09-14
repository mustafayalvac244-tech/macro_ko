---
name: supabase-goc
description: Vekil Pro'nun Supabase göç (migration) kuralları — çok ifadeli dosya tuzağı, salt okunur ölçüm göçü kalıbı, RLS zorunluluğu, to_regclass koruması, fonksiyon gövdesi kapatma ve canlıya uygulama iş akışı. Kullanıcı tablo, sütun, indeks, politika, RPC, tetikleyici, şema değişikliği ya da "canlıda şu var mı / şunu ölç / göçü uygula" türünde herhangi bir veritabanı işi istediğinde MUTLAKA bu skill'i kullan — kullanıcı "migration" veya "skill" kelimesini hiç söylemese bile. supabase/migrations/ altına dosya yazarken ve SQL review ederken de geçerlidir.
---

# Vekil Pro — Supabase göçleri

`supabase/migrations/` altında bugün **130 göç** var. Sıradaki dosyanı
yazmadan önce buradakilere uy.

> **BU DOSYA ÖLÇÜLEREK YAZILDI (14.09.2026).** Aşağıdaki kuralların her biri
> bu depoda GERÇEKTEN OLMUŞ bir hatadan geliyor; hiçbiri genel tavsiye değil.

---

## 1. EN ÖNEMLİ KURAL — ölçüm göçü TEK İFADE olmalı

Uygulayıcı (Supabase Management API, tıpkı SQL Editor gibi) çok ifadeli bir
dosyada **yalnız SON ifadenin satırlarını** döndürür. Öncekiler sessizce
kaybolur — hata vermez, sadece yok olur.

**14.09.2026'da gerçekten oldu:** `0133_canli_dogrulama.sql` sekiz ayrı
`select` ile yazıldı, canlıda koşuldu, **yalnız sonuncusu döndü**, yedi ölçüm
kayboldu ve çıktıya bakıp "doğrulandı" sanıldı. Uyarı o sırada **üç ayrı
yerde** yazılıydı (`migration-uygula.yml:8`, `scripts/migration-uygula.mjs:7`
ve `:91`) — okunmadan yazıldı. Bu skill'in var olma sebebi tam olarak budur.

Doğru kalıp — `union all` ile tek ifade, sıra `sira` sütunuyla korunur:

```sql
select olcum, deger from (
  select 1 as sira, 'birinci olcum' as olcum,
    coalesce(..., 'YOK (!)') as deger
  from ...
  union all
  select 2, 'ikinci olcum', ...
  union all
  select 3, 'ucuncu olcum', ...
) ozet
order by sira;
```

Notlar:
- Her ölçüm `coalesce(..., 'YOK (!)')` ile kapanır. Satırın hiç dönmemesi ile
  "değer yok" ayrı şeylerdir; `(!)` işareti kayıtta gözle yakalanır.
- Sütun tipleri `union all` boyunca aynı olmalı — sayıları `::text` ile çevir.

---

## 2. Salt okunur ölçüm göçü — yerleşik bir kalıp

Depoda **9 tane** var (`0116`, `0117`, `0120`, `0121`, `0133`, `0134`, ...).
Hiçbir şey yazmayan, yalnız canlıyı ölçen göç. Ne zaman kullanılır:

- Bir göç "UYGULANDI" dedi diye **doğru oturduğu anlaşılmaz**. Göç hatasız
  koşup yine de beklenenden farklı şema bırakabilir (sütun tipi, kısıt,
  politika, tetikleyici). Ölçüm göçü o farkı kapatır.
- Yerel ≠ canlı. Canlıda pgvector, pg_cron, `KURULUM.sql` ve 130 göç birikmiş.

Dosya başlığında **neden yazıldığı** ve **ne ölçmediği** açıkça yazılır.

---

## 3. RLS — istisnasız

Yeni her tabloda:

```sql
alter table x enable row level security;
create policy "x own" on x for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
```

- `anon` rolüne açık politika yazma.
- Tasarımı gereği paylaşılan tablolarda (`jobs` gibi
  `using (auth.role() = 'authenticated')`) bu **bilinçli bir karardır** ve
  KVKK metnine yansıması gerekir — sessizce yapma.
- Arka plan/yönetim fonksiyonları `authenticated` ve `anon` için "permission
  denied" vermeli (`0079_rpc_yetki_kilidi.sql` bu kilidi kuruyor).
- Kişisel veri döndüren RPC'ler `security definer` + **açık sütun listesi**
  ile yazılır; `select *` ile telefon/e-posta/TC sızdırma
  (örnek: `0027_chat_public_profile_rpcs.sql`).

---

## 4. Ölçülmüş SQL tuzakları

**`create index if not exists` TABLOYU değil İNDEKSİ kontrol eder.**
Tablo yoksa hata verip göçü düşürür. Tablo varlığı belirsizse koru
(depoda 9 göç böyle yapıyor):

```sql
do $$ begin
  if to_regclass('public.x') is not null then
    create index if not exists x_y_idx on public.x (y);
  end if;
end $$;
```

**`$function$` gövdesinin ardından `;` gelmeli.** Yoksa sonraki ifade gövdenin
devamı sanılır ve hata çok daha ileride, anlaşılmaz biçimde çıkar.
(`0068` ve `0069` bu yüzden düzeltildi; doğru kalıp 6 göçte var.)
`kontrol.yml` iş akışında bunu yakalayan bir bekçi var.

**`round(numeric, 2)` Postgres'te yarımı sıfırdan uzağa yuvarlar.** JS tarafı
eşleşsin istiyorsan `Math.round((x + Number.EPSILON) * 100) / 100`. Ölçüldü:
iki taraf da 144,03.

**Hesaplanan sütunu `generated always` yap.** Sıradan sütun olsaydı uygulama
ne yazarsa o kalırdı ve ekranla rapor ayrışırdı
(`time_entries.amount` böyle; canlıda `ALWAYS` olduğu 0133 ile ölçüldü).

---

## 5. Sağlık verisi — bu depoya girmez

`AGENTS.md` kuralı: sağlık/ilaç/reçete/hasta verisi tutan tablo, göç, uç
işlevi ya da ekran **eklenmez**. Var olan eczane tabloları **silinmez** —
başka bir ürünün verisi.

**Dikkat, ölçülmüş tuzak:** `tests/saglikVerisiAyrimi.test.ts` göç
dosyalarında eczane tablo ADI görmek istemiyor ve "ekliyorum" ile "hariç
tutuyorum" ayrımını yapamaz. 14.09.2026'da `0133`'ün FK sayımında bu adlar
bir `not in (...)` listesindeydi ve test haklı olarak düştü.

**Testi gevşetme, göçü düzelt.** O olayın asıl dersi ad listesi değildi:
hangi satırın çıkacağı varsayılıp ölçümden elenmişti. Filtresiz koşunca
gerçek sonuç göründü (dört eczane sütunu; bizim tablolarımız temiz).
**Ölçümü, sonucu görmeden filtreleme.**

---

## 6. Canlıya uygulama

`.github/workflows/migration-uygula.yml` iş akışını `migrationlar` girdisiyle
çalıştır (örn. `0134`). Mevcut `SUPABASE_ACCESS_TOKEN` secret'ını kullanır.

- **`service_role` / `sb_secret_` anahtarı hiçbir koşulda istenmez,
  alınmaz, yazılmaz.** RLS'i baypas eder.
- Çıktı Actions kaydında görünür — ölçüm göçlerinin satırları oradan okunur.
- Uygulandıktan sonra **"uygulandı" ile "doğru oturdu" aynı şey değildir**:
  şema değiştiren bir göçün ardından bölüm 2'deki ölçüm göçünü yaz.
- Uygulama kodu yeni bir tabloya `.from('x')` diyorsa, `tests/semaKapsami.test.ts`
  o tablo için bir `create table` arar — göçü yazmadan ekran yazma.
