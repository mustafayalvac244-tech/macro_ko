-- ANON'UN FAZLADAN TUTTUĞU YETKİLER — canlı projede ölçüldü.
-- ---------------------------------------------------------------------------
-- NASIL ÖLÇÜLDÜ (tahmin değil): uygulamanın KENDİ genel (anon) anahtarıyla —
-- ki bu anahtar uygulama paketinin ve web derlemesinin içinde yayımlanıyor,
-- yani herkeste var — canlı PostgREST'e 36 tablo için SELECT denendi.
--
-- SONUÇ, iki parçalı:
--
--  İYİ TARAF: 32 tablo istek kabul etti ama 31'i BOŞ döndü. Yani satır
--  düzeyi güvenlik (RLS) görevini yapıyor; kullanıcı verisine (cases,
--  clients, documents, finance_entries, dm_messages...) anon ile
--  ERİŞİLEMİYOR. Buradaki tablo yetkileri Supabase'in varsayılanı ve tek
--  başına zarar vermiyorlar.
--
--  KÖTÜ TARAF, iki madde:
--
--   1) public.tr_kucult(text) HERKESE AÇIKTI. Ölçüm: anon anahtarıyla
--      POST /rest/v1/rpc/tr_kucult {"t":"İŞ KAZASI"} → HTTP 200 "iş kazası".
--      BU BENİM İHMALİM: fonksiyonu 0103'te yazdım ve revoke etmeyi UNUTTUM;
--      PostgreSQL'de yeni fonksiyon varsayılan olarak PUBLIC'e açıktır.
--      Veri sızdırmıyor (saf metin işlevi) ama dışarıya açılan her uç yüzeyi
--      büyütür ve projedeki kural açık: gereksiz hiçbir şey açık kalmaz.
--      (Aynı ölçüm iyi haberi de verdi: hasat_saglik, hasat_onceligini_tazele,
--      disk_musait_mi ve delete_account anon'a 42501 "permission denied"
--      döndü — yani onların kilidi tutuyor.)
--
--   2) legal_rule_atif 70 SATIRI anon'a VERİYOR. Ölçüm: 32 tablo içinde
--      satır döndüren TEK tablo bu. Kaza değil — migration 0066'da bilerek
--      "for select to authenticated, anon using (true)" yazılmış. İçeriği
--      bizim kural→kanun maddesi eşlememiz (ör. ihtiyac_tahliye → TBK 355).
--      Uygulama zaten giriş şartı koyuyor; bu eşlemeyi giriş yapmamış birine
--      açık tutmanın hiçbir gerekçesi yok. Politika 'authenticated'a daraltıldı.
--
-- AYRICA — HAVUZU ŞİMDİDEN KAPATIYORUZ. ictihat_kararlar ve
-- ictihat_harvest_state şu an boş dönüyor, ama BUNUN SEBEBİNİ DIŞARIDAN
-- ÖLÇEMEDİM: RLS mi tutuyor, yoksa havuz hâlâ boş mu? İkisi de mümkün ve
-- ikisinin sonucu çok farklı. Hasat çalışıp havuz dolduğunda RLS kapalıysa
-- korpusun tamamı anon anahtarıyla indirilebilir hâle gelirdi — ürünün asıl
-- değeri tam olarak o korpus.
--
-- Bu yüzden beklemiyoruz. ÖLÇÜLEN GERÇEK: istemci kodunda (src/ + app/) bu
-- iki tabloya TEK BİR başvuru yok; uygulama içtihada yalnız `ictihat` edge
-- işlevi üzerinden erişiyor, o da SUPABASE_SERVICE_ROLE_KEY kullanıyor
-- (supabase/functions/ictihat/index.ts:466). Yani anon ve authenticated
-- yetkilerini almak HİÇBİR ŞEYİ bozmaz. service_role RLS'i zaten aşar.

-- ── 1) Unutulan fonksiyon kilidi ────────────────────────────────────────────
revoke all on function public.tr_kucult(text) from public, anon, authenticated;

-- ── 2) İçtihat havuzu: yalnız sunucu tarafı ─────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['ictihat_kararlar','ictihat_harvest_state','ictihat_atif'] loop
    if to_regclass('public.'||t) is not null then
      execute format('revoke all on public.%I from anon, authenticated', t);
      -- Kuşak ve kemer: yetki bir gün geri gelirse RLS hâlâ tutsun.
      execute format('alter table public.%I enable row level security', t);
    end if;
  end loop;
end $$;

-- ── 3) Yalnız sunucunun okuduğu referans tabloları anon'a kapalı ────────────
-- (authenticated'a dokunulmuyor: bu tabloları okuyan security definer
--  fonksiyonlar var ve gereksiz yere bir şey bozmak istemiyoruz.)
do $$
declare t text;
begin
  foreach t in array array['mevzuat_maddeleri','legal_rules'] loop
    if to_regclass('public.'||t) is not null then
      execute format('revoke all on public.%I from anon', t);
    end if;
  end loop;
end $$;

-- ── 4) legal_rule_atif: anon okuması kaldırıldı ─────────────────────────────
do $$
begin
  if to_regclass('public.legal_rule_atif') is not null then
    drop policy if exists legal_rule_atif_read on public.legal_rule_atif;
    create policy legal_rule_atif_read on public.legal_rule_atif
      for select to authenticated using (true);
    revoke all on public.legal_rule_atif from anon;
  end if;
end $$;

-- ── 5) Cihaz listesi: anon'un işi yok ───────────────────────────────────────
-- 0099 "grant select ... to authenticated" yazdı ama anon'dan SELECT'i hiç
-- ALMADI; Supabase varsayılanı yüzünden anon'da duruyordu. RLS tutuyordu,
-- yine de yetkinin kendisi gereksiz.
do $$
begin
  if to_regclass('public.oturum_cihazlari') is not null then
    revoke all on public.oturum_cihazlari from anon;
  end if;
end $$;

-- ── DOĞRULAMA ───────────────────────────────────────────────────────────────
-- Çıktıdaki her satır 'f' olmalı. 't' kalan varsa kapanmamış demektir.
select 'tr_kucult / anon EXECUTE' as kontrol,
       has_function_privilege('anon', 'public.tr_kucult(text)', 'EXECUTE') as hala_acik
union all
select 'ictihat_kararlar / anon SELECT',
       coalesce(has_table_privilege('anon', 'public.ictihat_kararlar', 'SELECT'), false)
where to_regclass('public.ictihat_kararlar') is not null
union all
select 'ictihat_kararlar / authenticated SELECT',
       coalesce(has_table_privilege('authenticated', 'public.ictihat_kararlar', 'SELECT'), false)
where to_regclass('public.ictihat_kararlar') is not null
union all
select 'ictihat_harvest_state / anon SELECT',
       coalesce(has_table_privilege('anon', 'public.ictihat_harvest_state', 'SELECT'), false)
where to_regclass('public.ictihat_harvest_state') is not null
union all
select 'legal_rule_atif / anon SELECT',
       coalesce(has_table_privilege('anon', 'public.legal_rule_atif', 'SELECT'), false)
where to_regclass('public.legal_rule_atif') is not null
union all
select 'oturum_cihazlari / anon SELECT',
       coalesce(has_table_privilege('anon', 'public.oturum_cihazlari', 'SELECT'), false)
where to_regclass('public.oturum_cihazlari') is not null
union all
-- Bu İKİSİ 't' OLMALI: bozmadığımızın kanıtı.
select 'oturum_cihazlari / authenticated SELECT (t olmalı)',
       coalesce(has_table_privilege('authenticated', 'public.oturum_cihazlari', 'SELECT'), false)
where to_regclass('public.oturum_cihazlari') is not null
union all
select 'ictihat_kararlar / service_role SELECT (t olmalı)',
       coalesce(has_table_privilege('service_role', 'public.ictihat_kararlar', 'SELECT'), false)
where to_regclass('public.ictihat_kararlar') is not null;
