-- KORPUS HÂLÂ SIZIYORDU — definer fonksiyonlar tablo kilidini aşıyor.
-- ===========================================================================
-- ÖLÇÜLEN SIZINTI (canlı, uygulamanın kendi genel anon anahtarıyla):
--
--     POST /rest/v1/rpc/kararlar_madde_ile {"p_kanun":"TBK","p_madde":344}
--     → HTTP 200, 3 satır
--       {"id":"145391400","kurul":"Yargıtay",
--        "daire":"Yargıtay 6. Hukuk Dairesi","esas_no":"2014/12964", ...}
--
-- Yani giriş yapmamış herkes, uygulama paketinde yayımlanan anahtarla içtihat
-- havuzunu madde madde okuyabiliyordu.
--
-- NEDEN 0104 YETMEDİ: tabloyu kilitledim ama SECURITY DEFINER bir fonksiyon
-- tablo yetkisini zaten AŞAR — sahibinin yetkisiyle koşar. Tabloyu kilitlemek,
-- o tabloyu okuyan definer fonksiyonlar anon'a açıkken hiçbir şey ifade etmez.
--
-- NEDEN 0106 YETMEDİ: filtresinde `and not p.prosecdef` vardı — "zaten definer
-- olanlara dokunma". O filtre, kırılmış olanları düzeltmek için doğruydu ama
-- SIZDIRABİLECEK OLANLARI tam olarak dışarıda bıraktı. İki düzeltme üst üste
-- yazıldı ve ikisi de aynı deliği görmedi; delik ancak doğrulama tablosundaki
-- `anon=true` satırlarına bakınca göründü.
--
-- DERS: bir yetki düzeltmesini "uyguladım" diye değil, KARŞI TARAFTAN
-- DENEYEREK doğrulamak gerekiyor. Bu delik, düzeltmenin kendi çıktısındaki
-- satırlar okunduğu için bulundu.
--
-- BU DOSYA: korunan tabloları okuyan TÜM fonksiyonlardan (definer olsun ya da
-- olmasın) anon ve PUBLIC yetkisini alır. Uygulama zaten giriş şartı koyuyor;
-- bu fonksiyonların hiçbirine giriş yapmamış birinin erişmesi gerekmiyor.
--
-- YETKİ GENİŞLETİLMEZ: yalnız zaten authenticated'ın çağırabildiği fonksiyonlar
-- ele alınır, yani service_role'a kilitli olanlara (hasat_tetikle,
-- hasat_saglik, hasat_onceligini_tazele...) dokunulmaz.

do $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select p.oid::regprocedure as imza, p.proname
    from pg_proc p
    join pg_namespace nsp on nsp.oid = p.pronamespace
    where nsp.nspname = 'public'
      and p.prokind = 'f'
      -- 0106'daki `not p.prosecdef` filtresi BİLEREK YOK: asıl sızdıranlar
      -- zaten definer olanlardı.
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and has_function_privilege('anon', p.oid, 'EXECUTE')
      and pg_get_functiondef(p.oid) ~*
          '(ictihat_kararlar|ictihat_atif|ictihat_harvest_state|mevzuat_maddeleri|legal_rules|legal_rule_atif)'
  loop
    -- PUBLIC'ten de almak ŞART: yeni fonksiyona varsayılan olarak PUBLIC'e
    -- EXECUTE verilir ve anon yetkiyi oradan alır; yalnız `from anon` demek
    -- hiçbir şey yapmaz (0106'da bu tuzağa düşüp yerelde yakalandı).
    execute format('revoke execute on function %s from public, anon', r.imza);
    execute format('grant execute on function %s to authenticated, service_role', r.imza);
    raise notice 'anon kapatıldı: %', r.imza;
    n := n + 1;
  end loop;
  raise notice 'toplam % fonksiyon kapatıldı', n;
end $$;

-- ── DOĞRULAMA ───────────────────────────────────────────────────────────────
-- HEPSİNDE anon=false OLMALI. Bir tanesi bile true kalırsa korpus oradan
-- okunmaya devam eder — tablo kilidi bunu engellemez.
select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as fonksiyon,
       'anon=' || has_function_privilege('anon', p.oid, 'EXECUTE') ||
       ' · authenticated=' || has_function_privilege('authenticated', p.oid, 'EXECUTE') ||
       ' · definer=' || p.prosecdef as durum
from pg_proc p
join pg_namespace nsp on nsp.oid = p.pronamespace
where nsp.nspname = 'public'
  and p.prokind = 'f'
  and pg_get_functiondef(p.oid) ~*
      '(ictihat_kararlar|ictihat_atif|ictihat_harvest_state|mevzuat_maddeleri|legal_rules|legal_rule_atif)'
  and has_function_privilege('authenticated', p.oid, 'EXECUTE')
order by has_function_privilege('anon', p.oid, 'EXECUTE') desc, p.proname;
