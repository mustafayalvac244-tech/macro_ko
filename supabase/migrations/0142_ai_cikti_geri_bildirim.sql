-- AI ÇIKTI GERİ BİLDİRİMİ — avukatın düzeltmesini ÖLÇ, metnini SAKLAMA
-- ===========================================================================
--
-- NEDEN VAR. `DuzenlenebilirCikti` bileşeni avukatın taslağı düzenlemesine
-- izin veriyor ve ekranda "düzenlendi" diye işaretliyor — ama o bilgi hiçbir
-- yere yazılmıyordu. Yani şu an sahip olabileceğimiz EN DEĞERLİ sinyali
-- (gerçek bir avukatın, gerçek bir dosyada, gerçek düzeltmesi) çöpe atıyoruz.
--
-- Bu tablo o sinyali yakalar ve şu soruyu ölçülebilir kılar:
--   "Hangi mod ve hangi model, avukatın olduğu gibi kullandığı çıktı üretiyor?"
--
-- 16.09.2026'da kurulan işe göre model tablosu (MOD_UCUZ: sohbet/künye Haiku)
-- bir VARSAYIMDI — Haiku'nun yeterli olduğu ölçülmemişti. Bu tablo o varsayımı
-- sınayacak veriyi üretir: Haiku çıktıları ağır düzeltiliyorsa mod geri alınır.
--
-- ── METİN SAKLANMIYOR — BİLİNÇLİ VE KVKK GEREĞİ ───────────────────────────
--
-- Bu tabloda dilekçe metni, düzeltme metni ya da herhangi bir fark (diff) YOK.
-- Yalnız UZUNLUK ve DEĞİŞİM ORANI var.
--
-- Sebep basit: taslak metni avukatın MÜVEKKİLİNE ait kişisel veri içerir —
-- yani veri sahibi kullanıcımız bile değil, ÜÇÜNCÜ KİŞİ. Onu "ürün
-- geliştirme" amacıyla saklamak, aydınlatma metnimizde bulunmayan YENİ BİR
-- İŞLEME AMACI açar. Bunu yapmak KVKK_SURUM'u artırmayı ve bütün
-- kullanıcılardan yeniden rıza almayı gerektirir (bkz. src/config/kvkk.ts —
-- sürüm artırmanın gerekçesi orada aynen yazılı).
--
-- Metinli sürüm ileride kurulabilir ama AYRI BİR İŞTİR ve sırası şudur:
--   1) aydınlatma metnine amaç eklenir  2) KVKK_SURUM artırılır
--   3) gönderim başına AÇIK onay kutusu  4) ancak o zaman metin saklanır
-- Bu sıra atlanarak metin saklanmamalı.
--
-- METİNSİZ HÂLİ ZATEN İŞE YARIYOR: "dilekçe çıktılarının %70'i ağır
-- düzeltiliyor, sohbetinkilerin %5'i" cümlesi tek başına yönlendirme tablosunu
-- düzeltmeye yeter. Nerede sorun olduğunu söyler; ne olduğunu söylemez.

create table if not exists public.ai_cikti_geri_bildirim (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,

  -- ai_istek.id — hangi isteğin çıktısı olduğunu bağlar. NULLABLE: istemci
  -- her zaman alamayabilir (eski sürüm, yeniden üretim) ve bağlanamayan bir
  -- kayıt, hiç kayıt olmamasından iyidir.
  istek_id uuid,

  -- 'dilekce' | 'mutalaa' | 'belge' | 'kunye' | 'sohbet'
  -- CHECK KONULMADI: mod listesi uç işlevde yaşıyor ve orada yeni bir mod
  -- eklendiğinde buradaki check'i güncellemeyi unutmak, geri bildirimi
  -- SESSİZCE düşürürdü. Ölçüm tablosunun veri kaybetmesi, tanımadığı bir
  -- değeri kaydetmesinden kötüdür.
  mod text not null,

  -- Çıktıyı üreten model (claude-sonnet-5, claude-haiku-4-5-... ).
  -- Yönlendirme tablosunu sınayan asıl sütun bu.
  model text,

  asil_uzunluk int not null check (asil_uzunluk >= 0),
  son_uzunluk  int not null check (son_uzunluk  >= 0),

  -- 0 = hiç dokunulmadı, 1 = tamamen yeniden yazıldı.
  -- İstemcide ucuz bir ölçüyle hesaplanır (ortak önek/sonek kırpma) — tam bir
  -- düzenleme mesafesi DEĞİLDİR ve dağınık düzeltmelerde olduğundan büyük
  -- çıkar. Sıralama ve kıyas için yeter, mutlak yorum için yetmez.
  degisen_oran numeric(4,3) not null check (degisen_oran >= 0 and degisen_oran <= 1),

  duzenlendi boolean not null,
  olusturuldu timestamptz not null default now()
);

create index if not exists ai_cikti_gb_mod_model_idx
  on public.ai_cikti_geri_bildirim (mod, model, olusturuldu desc);

alter table public.ai_cikti_geri_bildirim enable row level security;

-- YAZMA: yalnız kendi adına. Kullanıcı başkasının kaydını üretemez.
create policy "cikti gb owner insert" on public.ai_cikti_geri_bildirim
  for insert with check (auth.uid() = owner_id);

-- OKUMA: kullanıcı KENDİ kayıtlarını görür.
-- Toplu analiz admin panelinden (service_role) yapılır; bütün kullanıcıların
-- düzeltme davranışını herkese açmak, kimsenin işine yaramayan bir veri
-- sızıntısı yüzeyi olurdu.
create policy "cikti gb owner select" on public.ai_cikti_geri_bildirim
  for select using (auth.uid() = owner_id);

-- GÜNCELLEME/SİLME POLİTİKASI YOK = YASAK. Ölçüm kaydı sonradan
-- değiştirilebilirse ölçüm olmaktan çıkar.

comment on table public.ai_cikti_geri_bildirim is
  'AI çıktısını avukat ne kadar düzeltti — METİN SAKLANMAZ, yalnız uzunluk ve '
  'değişim oranı. Amaç: işe göre model tablosunu (MOD_UCUZ) ölçümle sınamak. '
  'Metinli sürüm için önce aydınlatma metni + KVKK_SURUM + açık onay gerekir.';
