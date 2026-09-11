-- İÇTİHAT ARAMASINI KIRMIŞIM — 0104'ün yan etkisi. ACİL DÜZELTME.
-- ===========================================================================
-- NE OLDU. 0104'te içtihat havuzunu korumak için şunu yaptım:
--     revoke all on public.ictihat_kararlar from anon, authenticated;
--     alter table public.ictihat_kararlar enable row level security;
-- Gerekçe doğruydu: anon anahtarı uygulama paketinde yayımlanıyor ve havuz
-- ürünün asıl değeri. Ama ARAMA YOLUNU KONTROL ETMEDİM.
--
-- ÖLÇÜLEN KIRILMA (canlı, anon anahtarıyla):
--     POST /rest/v1/rpc/search_ictihat_fts {"q":"kira tespit davası"}
--     → 401  42501  "permission denied for table ictihat_kararlar"
--
-- SEBEBİ: bu iki arama fonksiyonu SECURITY DEFINER DEĞİL —
--     search_ictihat_fts      → language plpgsql stable      (definer yok)
--     match_ictihat_semantic  → language sql stable          (definer yok)
-- yani ÇAĞIRANIN yetkisiyle çalışıyorlar ve tabloya doğrudan SELECT
-- istiyorlar. Kardeşleri (search_mevzuat_fts, search_legal_rules) definer
-- yazılmış; bu ikisi atlanmış. Ben de tablo yetkisini alınca bunlar düştü.
--
-- KİMİ ETKİLEDİ: `ictihat` edge işlevi bu RPC'leri ANON anahtarlı + kullanıcı
-- JWT'li istemciyle çağırıyor (ictihat/index.ts:698 → 794, 854, 863, 1107),
-- yani `authenticated` rolüyle. ai-chat da beslemede aynı RPC'leri kullanıyor
-- (1385, 1387). Sonuç: içtihat araması ve AI'ın içtihat beslemesi kırıldı.
-- Uygulamanın en güçlü ve ÜCRETSİZ özelliği buydu.
--
-- ── DÜZELTMENİN YÖNÜ ────────────────────────────────────────────────────────
-- Tablo yetkisini GERİ VERMİYORUZ. Vermek, korumayı tamamen geri almak olurdu
-- ve havuz yine anon anahtarıyla indirilebilir hâle gelirdi.
--
-- Doğru mimari zaten kardeş fonksiyonlarda yazılı: tablo kapalı, erişim
-- SECURITY DEFINER arama fonksiyonları üzerinden. Bu dosya atlanan ikisini
-- (ve canlıda var olup bu depoda tanımı bulunmayan benzerlerini) o hizaya
-- getiriyor.
--
-- NEDEN ALTER, NEDEN CREATE OR REPLACE DEĞİL: kararlar_madde_ile ve
-- match_mevzuat_semantic gibi bazı fonksiyonların tanımı bu depoda YOK
-- (canlıda yaratılmışlar). Gövdelerini bilmeden yeniden yazmak onları
-- bozardı. `alter function ... security definer` gövdeye hiç dokunmaz.
--
-- YETKİ GENİŞLETMİYORUZ: yalnızca ZATEN authenticated'ın çağırabildiği
-- fonksiyonlar değiştiriliyor. Yani kimin çağırabileceği aynı kalıyor,
-- değişen tek şey hangi yetkiyle KOŞTUKLARI. Bu sayede hasat_tetikle,
-- hasat_onceligini_tazele, hasat_saglik gibi service_role'a kilitli
-- fonksiyonlara dokunulmuyor.
--
-- ANON'DAN ALIYORUZ: definer yapılan bir fonksiyonu anon çağırabilseydi,
-- korumak istediğimiz korpusu tam olarak o fonksiyon üzerinden sızdırırdık.

do $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select p.oid::regprocedure as imza
    from pg_proc p
    join pg_namespace nsp on nsp.oid = p.pronamespace
    where nsp.nspname = 'public'
      and p.prokind = 'f'
      and not p.prosecdef                                    -- zaten definer olanlara dokunma
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')  -- yetki GENİŞLETME
      and pg_get_functiondef(p.oid) ~* '(ictihat_kararlar|ictihat_atif|ictihat_harvest_state)'
  loop
    execute format('alter function %s security definer', r.imza);
    execute format('alter function %s set search_path = public', r.imza);
    -- Definer olan bir fonksiyon anon'a açık kalırsa korpus oradan sızar.
    --
    -- PUBLIC'TEN DE ALMAK ŞART. PostgreSQL yeni fonksiyona varsayılan olarak
    -- PUBLIC'e EXECUTE verir; yalnız `from anon` demek hiçbir şey yapmaz çünkü
    -- anon yetkiyi PUBLIC üzerinden almaya devam eder. Yerel koşuda tam olarak
    -- bu oldu: revoke sonrası anon=true kaldı. (Aynı tuzak 0098'de sütun bazlı
    -- revoke'ta da yaşanmıştı — tablo yetkisi varken sütun revoke'u etkisizdi.)
    execute format('revoke execute on function %s from public, anon', r.imza);
    -- PUBLIC kalkınca meşru çağıranlara açıkça vermek gerekir.
    execute format('grant execute on function %s to authenticated, service_role', r.imza);
    raise notice 'definer yapıldı: %', r.imza;
    n := n + 1;
  end loop;
  raise notice 'toplam % fonksiyon düzeltildi', n;
end $$;

-- ── DOĞRULAMA ───────────────────────────────────────────────────────────────
-- Beklenen: arama fonksiyonları definer=t, anon=f, authenticated=t;
-- tablo ise her iki role de KAPALI (koruma yerinde duruyor).
select 'fonksiyon' as tur,
       p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as ad,
       'definer=' || p.prosecdef ||
       ' · anon=' || has_function_privilege('anon', p.oid, 'EXECUTE') ||
       ' · authenticated=' || has_function_privilege('authenticated', p.oid, 'EXECUTE') as durum
from pg_proc p
join pg_namespace nsp on nsp.oid = p.pronamespace
where nsp.nspname = 'public'
  and p.prokind = 'f'
  and p.proname in ('search_ictihat_fts', 'match_ictihat_semantic', 'kararlar_madde_ile',
                    'search_mevzuat_fts', 'search_legal_rules', 'match_mevzuat_semantic',
                    'search_mevzuat_kural')
union all
select 'tablo',
       'ictihat_kararlar',
       'anon=' || coalesce(has_table_privilege('anon', 'public.ictihat_kararlar', 'SELECT'), false) ||
       ' · authenticated=' || coalesce(has_table_privilege('authenticated', 'public.ictihat_kararlar', 'SELECT'), false) ||
       '   (ikisi de false OLMALI — koruma yerinde)'
where to_regclass('public.ictihat_kararlar') is not null
order by tur desc, ad;
