-- 0194 — VERİTABANI GÜVENLİĞİ (RLS / SECURITY DEFINER / grant) — 10.10.2026
--
-- KAYNAK. 08.10'daki 50 AI denetçisinin iddiaları (DOĞRULANMADI sayıldı).
-- Her iddia canlıda 10.10'da pg_policies / pg_proc / information_schema /
-- has_*_privilege ile SALT OKUNUR ölçüldü; kullanıcı satırı OKUNMADI. Aşağıdaki
-- "ÖNCE" satırları o ölçümdür. Bu dosya CANLIYA UYGULANMADI (yayın kararı
-- ürün sahibinde); yerelde iki kez koşuldu (scripts/migration-deneme).
--
-- ═══ 1) profiles — giriş yapan HERKES başka avukatın profilini listeliyordu ═══
-- ÖNCE (ölçüldü): politika "profiles readable by authenticated" SELECT
--   using (auth.role() = 'authenticated')  [0007] + authenticated'a sütun
--   SELECT'i: id, full_name, firm_name, bar_number, avatar_url, created_at,
--   updated_at, is_premium, friend_code, baro, is_admin  [0024].
--   Yani PostgREST'ten `profiles?select=full_name,bar_number,is_admin` ile
--   (reltuples tahmini ~30) tüm kullanıcıların ad/büro/baro no/yönetici
--   bayrağı/arkadaş kodu okunuyordu. 0158 meslektaş özelliklerini kapatıp
--   search_lawyers/public_profiles RPC'lerini geri almıştı; TABLO yolu açık
--   kalmıştı — kapanışı deliyordu. (E-posta/telefon/TC sütun yetkisiyle zaten
--   kapalıydı.)
-- SONRA: yalnız "profiles are self-readable" (id = auth.uid()) kalır.
-- ETKİLENEN EKRAN: yayındakilerden YOK. src ve app taraması (10.10): başka
--   kullanıcının profilini tablodan gömen tek yer useOffice.ts (ofis üyeleri,
--   ofis mesajı gönderen) ve useDailyQuestion.ts (liderlik tablosu); ikisini
--   de yalnız src/ekranlar-beklemede kullanıyor (yayından çıkarılmış, 14.09
--   KARAR-DEFTERI). O ekranlar geri açılırken profil adları için security
--   definer RPC gerekir — tests/veritabaniGuvenligi0194.test.ts bu iki kancanın
--   yayındaki koda sızmasını bekçiler. Bu göçte RPC YAZILMADI (yeni özellik
--   olurdu; ürün sahibi kararı: o ekranlar kapalı).
-- YAN ETKİ, İYİ YÖNDE (ölçülmedi, KOD OKUMASINDAN ÇIKARIM): ai-chat
--   dosyaKunyesi (index.ts ~2830) profiles'ı süzgeçsiz `.maybeSingle()` ile ve
--   KULLANICI JWT'li istemciyle okuyor. Genel okuma varken ~30 satır döner,
--   maybeSingle hata verir, avukatın adı/baro bilgisi dilekçe künyesine hiç
--   gelmezdi. Politika kalkınca yalnız kendi satırı döner ve künye dolar. Bu,
--   AI taslaklarında kullanıcıya görünen bir değişikliktir.
--
-- ═══ 2) search_ictihat_fts — match_count sınırsızdı ═══
-- ÖNCE: authenticated EXECUTE (ölçüldü: true), match_count doğrudan
--   kullanılıyor; PostgREST'ten match_count=100000 verilebiliyordu. Her
--   basamak 1500 adayla sınırlı (TAVAN) ama dönen satır sayısı sınırsızdı.
-- SONRA: 1..20 arasına sıkıştırılır (null = 15, eski varsayılan). 20, uygulamanın
--   kendi en büyük isteği: ictihat ucu pageSize = min(20, ...) (index.ts:889);
--   ai-chat 2 ve 4, eval betikleri 4–5 istiyor.
-- NOT: EXECUTE authenticated'da KALIYOR — ai-chat satır 1917 bu RPC'yi
--   kullanıcı JWT'li istemciyle çağırıyor; kapatmak AI aramasını kırardı.
--   Gövde 0172 ile aynıdır (ölçüldü: canlı gövde yalnız yorum satırlarında
--   farklı); tek eklenen: aşağıdaki tavan satırı.
--
-- ═══ 3) kullanim_kaydet — anon'a açık, anahtar sayısı sınırsız ═══
-- ÖNCE: anon ve authenticated EXECUTE (ölçüldü: true). Biçime uyan HER farklı
--   olay dizesi tabloya yeni satır açıyordu (PK = gün, olay, platform) →
--   oturumsuz biri yayımlanabilir anahtarla tabloyu şişirebilir, yönetici
--   özetini (limit 60) çöple doldurabilirdi.
-- SONRA: bir günde en çok 500 satır; var olan anahtar saymaya devam eder,
--   YENİ anahtar tavanda sessizce atlanır (eski biçim reddi gibi). Ölçüm:
--   canlıda günlük en çok 29 satır (03–10.10, 34 farklı ekran + 3 olay).
--   500 = ÖLÇÜLMEDİ, TAHMİN (ölçülen tepenin ~17 katı; ekran sayısı × 3
--   platform + kampanya kaynaklarına yeter).
-- SINIR (dürüst): AYNI anahtarı milyon kez çağırıp sayacı ŞİŞİRMEK hâlâ
--   mümkün; anon çağrısı giriş/kayıt ekranları için zorunlu ve Postgres'te
--   hız sınırı yok. Bu göç tablonun BÜYÜMESİNİ kapatır, sayının doğruluğunu
--   garanti etmez.
--
-- ═══ 4) kvkk_onay — rıza kaydı istemciden sahtelenebiliyordu (0128:44-46) ═══
-- ÖNCE (ölçüldü): authenticated tablo-geneli INSERT/UPDATE/DELETE yetkisi
--   (has_table_privilege true; UPDATE/DELETE'i yalnız politika YOKLUĞU
--   engelliyordu) ve INSERT politikası yalnız `auth.uid() = user_id`.
--   İstemci verildi_at'ı geçmişe/geleceğe, kaynak'ı tetikleyiciye özgü
--   'kayit'e, tur/surum/kanit'i rastgele yazabiliyordu. Tablonun anlamı "ne
--   zaman, hangi sürüme, nereden" DELİLİ olmak; üçü de istemci beyanıydı.
-- SONRA: (a) UPDATE/DELETE/TRUNCATE yetkisi authenticated/anon'dan alınır
--   (RLS'e ek, ikinci kilit); (b) INSERT yalnız (user_id, tur, surum, onay,
--   kaynak, kanit) sütunlarına: id ve verildi_at SUNUCU varsayılanı olur,
--   geriye/ileriye yazılamaz; (c) politika yalnız uygulamanın gerçekten
--   yazdığı değerleri kabul eder: tur = 'yurtdisi_ai', kaynak = 'ayarlar',
--   surum biçimi 1–32 karakter, kanit boş ya da nesne. Kayıt anı rızasını
--   yazan tetikleyici (security definer, tablo sahibi) etkilenmez.
-- SINIR (dürüst): kullanıcı kendi adına 'ayarlar' kaynağıyla onay satırı
--   yazmaya devam eder (meşru yol bu); kayıt anı rızası ise auth üstverisinden
--   gelir (istemci beyanı) — ikisi de değişmedi. Surum metninin İÇERİĞİ
--   doğrulanamaz, yalnız biçimi sınırlanır. Yeni bir rıza türü için bu
--   politikaya değer eklemek gerekir (bilinçli: delil günlüğü sessizce
--   genişlemesin).
--
-- ═══ 5) case_id / client_id — başkasının kaydına bağlama ═══
-- ÖNCE: 12 tabloda (case_expenses, case_installments, cases(client_id),
--   client_advances, client_expenses, deadlines, documents, enforcement_files,
--   hearings, payment_promises, payments, powers_of_attorney) politikalar yalnız
--   owner_id = auth.uid() diyor; case_id/client_id'nin KİMİN olduğuna bakan
--   hiçbir şey yoktu (pg_policies + pg_trigger ölçüldü; yalnız time_entries'te
--   0131 tetikleyicisi var). Kendi satırını başkasının dosya/müvekkil
--   kimliğine bağlamak mümkündü: o dosya silinince satır sessizce cascade ile
--   gider, FK hatası kimlik var/yok bilgisi sızdırır.
-- SONRA: ortak fk_sahip_denetimi() tetikleyicisi (0131'in genellemesi): INSERT
--   ve ilgili sütunlar/owner_id değişen UPDATE'te bağlı kaydın sahibi satırın
--   owner_id'si değilse 23503 (foreign_key_violation) — var olmayan kimlikle
--   AYNI kod ve ileti, yani kimlik varlığı sızmaz. Değişmeyen eski satırlar
--   denetlenmez (mevcut veri bu göçle kilitlenmesin).
-- ÖLÇÜLMEDİ: canlıda şimdiden başkasının kaydına bağlı satır var mı (kullanıcı
--   verisi okuma yasağı). Varsa dokunulmaz; yalnız yeni yazımlar denetlenir.
-- time_entries: kendi tetikleyicisi (0131) var, dokunulmadı.
--
-- ═══ 6) ai_saglayici_durum ve office_members ═══
-- ai_saglayici_durum ÖNCE: SELECT to authenticated using (true) [0050];
--   herkes sağlayıcı hata metnini (son_hata) ve hangi modelin kullanıldığını
--   okuyabiliyordu. Tek okuyucu: ai-saglik ucu (yönetici kapılı, kullanıcı JWT'li
--   istemciyle) ve security definer admin_ai_ozeti. SONRA: yalnız is_admin
--   (ai-saglik'in kendi is_admin kapısı bozulsa bile veri sızmaz).
-- office_members ÖNCE: "office admin insert members" with check = ofisin
--   SAHİBİ HERKESİ ekleyebilir (user_id serbest) → rızasız üye; eklenen kişi
--   ofis mesajlarını görür ve ofisin üye listesinde görünür. SONRA: yalnız
--   ofis sahibi KENDİNİ ekler (createOffice akışı: useOffice.ts ofis kurarken
--   sahibi 'admin' olarak ekliyor — çalışmaya devam eder). Başkasını ekleme
--   (useAddOfficeMember) bir DAVET/KABUL akışı olmadan kapalı; ofis ekranı
--   zaten yayında değil.
--
-- GERİ ALMA (bölüm bölüm): 1) 0007'deki create policy; 2) 0172'deki fonksiyon;
-- 3) 0165'teki fonksiyon; 4) grant insert on public.kvkk_onay to authenticated +
-- 0128'deki politika; 5) drop trigger fk_sahip_denetimi_t on <tablo>; 6) 0050 /
-- office_members için 0007'deki politika.

-- ── 1) profiles ──────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.profiles') is not null then
    drop policy if exists "profiles readable by authenticated" on public.profiles;
    -- 0001'den beri var; göç yalnız genel politikayı kaldırıyor, kendi-okumayı
    -- güvenceye alıyor (yoksa kullanıcı kendi profilini de göremezdi).
    if not exists (
      select 1 from pg_policies
       where schemaname = 'public' and tablename = 'profiles'
         and policyname = 'profiles are self-readable'
    ) then
      create policy "profiles are self-readable" on public.profiles
        for select using (auth.uid() = id);
    end if;
  end if;
end $$;

-- ── 2) search_ictihat_fts: match_count tavanı ───────────────────────────────
CREATE OR REPLACE FUNCTION public.search_ictihat_fts(q text, match_count integer DEFAULT 15)
 RETURNS TABLE(id text, kurul text, daire text, esas_no text, karar_no text, karar_tarihi text, durum text, snippet text, score real)
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = public
AS $function$
declare
  stopA text[] := array[
    'dava','davasi','davasinda','davada','davaya','davanin','acilir','acilan','acilmasi',
    'sure','suresi','suresinde','surede','surenin','kac','yil','yili','gun','gunu','ay','ayi',
    'madde','maddesi','kanun','kanunu','hukuk','hukuki','hukuku','mahkeme','mahkemesi','mahkemede',
    'hakim','karar','karari','kararin','taraf','tarafi','kisi','kisinin','nedir','midir','mudur',
    'ile','icin','olan','olarak','veya','gibi','bir','bu','ne','kadar','hangi','bagli','basvuru',
    'nasil','ise','yani','hem','daha','cok','vardir','var','yok','olur','gerekir','zorunlu',
    'dairesi','daire','yargitay','danistay','esas','sayili','hakkinda','uzere','ancak','ayrica',
    -- Soru dolguları: "kime verilir", "ne yapmalıyım" — kararlarda her yerde geçer.
    'kime','kimin','kim','verilir','verilmesi','yapmaliyim','istiyorum','edebilir','miyim'
  ];
  stopB text[] := array[
    'ile','icin','olan','olarak','veya','gibi','bir','bu','ne','kadar','hangi','nasil','ise','yani',
    'daha','cok','var','yok','olur','ben','beni','bana','benim','mi','mu','midir','mudur','nedir',
    'yapmaliyim','alabilir','miyim','istiyorum','oldu','edebilir','ama','fakat','ancak','dayanabilirim'
  ];
  -- Yavaş yol tavanı: OR/önek eşleşmelerinden en fazla bu kadarı puanlanır.
  TAVAN constant integer := 1500;
  q_clean text; lex text[]; n integer; tsq tsquery; tsq_and tsquery; tsq_n1 tsquery;
  parca text; parcalar text[] := '{}'; ii integer; jj integer;
  w text; total bigint; dl bigint; ds bigint;
  longs text[] := '{}'; shorts text[] := '{}'; wl real[] := '{}'; ws real[] := '{}'; orq text;
  -- Bulunanlar (sırayla) ve basamak sırası (0 = AND, 1 = n-1, 2 = OR, 3 = önek).
  ve_ids text[] := '{}';
  bu_ids text[];
  bu_sc real[];
  basamak integer := 0;
  tq tsquery;
  kalan integer;
begin
  -- 0194: tavan. authenticated bu RPC'yi PostgREST'ten doğrudan çağırabiliyor;
  -- sınırsız match_count tüm havuzu sayfalamadan çekmeye izin verirdi. 20 =
  -- uygulamanın kendi en büyük isteği (ictihat ucu pageSize <= 20).
  match_count := least(greatest(coalesce(match_count, 15), 1), 20);
  select string_agg(x, ' ') into q_clean from (
    select x from unnest(regexp_split_to_array(lower(coalesce(q, '')), '[^0-9a-zğüşıöçâîû]+')) x
    where length(x) >= 3 and translate(x, 'ğüşıöçâîû', 'gusiocaiu') <> all(stopA)) t;
  if q_clean is null or q_clean = '' then q_clean := coalesce(q, ''); end if;

  select array_agg(lexeme order by lexeme) into lex from (select distinct lexeme from unnest(to_tsvector('turkish', q_clean))) l;
  n := coalesce(array_length(lex, 1), 0);
  if n = 0 then return; end if;

  tsq     := to_tsquery('turkish', array_to_string(lex, ' | '));
  tsq_and := to_tsquery('turkish', array_to_string(lex, ' & '));
  -- ORTA BASAMAK: n-1 terim. Yalnız n >= 3 iken anlamlı (n=2'de "1 terim" = OR).
  if n >= 3 then
    for ii in 1..n loop
      parca := '';
      for jj in 1..n loop
        if jj <> ii then parca := parca || case when parca = '' then '' else ' & ' end || lex[jj]; end if;
      end loop;
      parcalar := parcalar || ('(' || parca || ')');
    end loop;
    tsq_n1 := to_tsquery('turkish', array_to_string(parcalar, ' | '));
  end if;

  -- ── MERDİVEN: AND → (n-1) → OR(tavanlı). Her basamak yalnız kalan yerleri doldurur. ──
  foreach tq in array array[tsq_and, tsq_n1, tsq] loop
    basamak := basamak + 1;
    continue when tq is null;
    kalan := match_count - coalesce(array_length(ve_ids, 1), 0);
    exit when kalan <= 0;
    -- 0172: aday sorgusu BASAMAK BAŞINA BİR KEZ. Eskiden aynı sorgu iki kez
    -- koşuyordu (biri döndürmek, biri ve_ids'e yazmak için); "limit TAVAN"
    -- sırasız olduğundan iki koşu farklı 1500 satırı da seçebiliyordu.
    select coalesce(array_agg(s.rid order by s.sc desc, s.rid), '{}'),
           coalesce(array_agg(s.sc order by s.sc desc, s.rid), '{}')
      into bu_ids, bu_sc
    from (
      select a.rid, ts_rank(a.v, tq, 1) as sc
      from (select k.id as rid, k.fts as v from public.ictihat_kararlar k
            where k.fts @@ tq and k.id <> all(ve_ids) limit TAVAN) a
      order by sc desc, a.rid
      limit kalan
    ) s;
    return query
      select k.id, k.kurul, k.daire, k.esas_no, k.karar_no, k.karar_tarihi, k.durum,
             left(k.full_text, 320) as snippet, x.sc::real
      from unnest(bu_ids, bu_sc) with ordinality as x(rid, sc, sira)
      join public.ictihat_kararlar k on k.id = x.rid
      order by x.sira;
    ve_ids := ve_ids || bu_ids;
  end loop;

  kalan := match_count - coalesce(array_length(ve_ids, 1), 0);
  if kalan <= 0 then return; end if;

  -- ── ÖNEK BASAMAĞI (0034'ün geri çağırma yolu), yalnız hâlâ yer varsa ────
  -- 0172: TAM SAYIM YERİNE PLANLAYICI İSTATİSTİĞİ. Ölçüldü 05.10.2026:
  -- count(*) 216.551 satırda 14.176 ms. Sayı yalnız IDF ağırlığında
  -- (ln(toplam/df)) kullanılıyor; istatistik ile gerçek arasındaki fark
  -- (211.716 / 216.551, %2) her terime yaklaşık aynı sabiti ekler.
  select greatest(c.reltuples, 0)::bigint into total from pg_class c where c.oid = 'public.ictihat_kararlar'::regclass;
  if coalesce(total, 0) <= 0 then select count(*) into total from public.ictihat_kararlar; end if;
  for w in select distinct x from unnest(regexp_split_to_array(lower(coalesce(q,'')), '[^0-9a-zğüşıöçâîû]+')) x
    where length(x) >= 3 and translate(x,'ğüşıöçâîû','gusiocaiu') <> all(stopB)
  loop
    select count(*) into ds from (select 1 from public.ictihat_kararlar k
      where k.fts_simple @@ to_tsquery('simple', left(w,4)||':*') limit 300) z;
    continue when ds = 0 or ds >= 300;
    select count(*) into dl from (select 1 from public.ictihat_kararlar k
      where k.fts_simple @@ to_tsquery('simple', w||':*') limit 300) z;
    shorts := shorts || left(w,4); ws := ws || ln((total+1.0)/(ds+1.0))::real;
    longs  := longs  || w;         wl := wl || ln((total+1.0)/(dl+1.0))::real;
  end loop;
  if array_length(shorts, 1) is null then return; end if;
  orq := array_to_string(array(select p||':*' from unnest(shorts) p), ' | ');

  return query
  with terms as (
    select to_tsquery('simple', shorts[i]||':*') tqs, to_tsquery('simple', longs[i]||':*') tql,
           ws[i] wshort, wl[i] wlong
    from generate_subscripts(shorts,1) i
  ),
  aday as (
    select k.id as rid, k.fts_simple as v
    from public.ictihat_kararlar k
    where k.fts_simple @@ to_tsquery('simple', orq) and k.id <> all(ve_ids)
    limit TAVAN
  ),
  b as (
    select a.rid,
      (select coalesce(sum(case when a.v @@ t.tql then t.wlong else t.wshort end),0)
         from terms t where a.v @@ t.tqs)
      * (select count(*) from terms t where a.v @@ t.tqs) sc
    from aday a
    order by sc desc, a.rid limit kalan
  )
  select k.id, k.kurul, k.daire, k.esas_no, k.karar_no, k.karar_tarihi, k.durum,
         left(k.full_text, 320) as snippet, b.sc::real
  from b join public.ictihat_kararlar k on k.id = b.rid
  order by b.sc desc, k.id;
end;
$function$;

revoke all on function public.search_ictihat_fts(text, integer) from public, anon;
grant execute on function public.search_ictihat_fts(text, integer) to authenticated, service_role;

-- ── 3) kullanim_kaydet: günlük satır tavanı ─────────────────────────────────
create or replace function public.kullanim_kaydet(p_olay text, p_platform text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_gun date := (now() at time zone 'Europe/Istanbul')::date;
begin
  if p_olay is null or p_olay !~ '^[a-z_]{2,20}:[a-z0-9_:/.-]{0,80}$' then
    return;
  end if;
  if p_platform is null or p_platform not in ('ios', 'android', 'web') then
    return;
  end if;
  -- YENİ anahtar ve gün dolmuşsa atla. Var olan anahtar saymaya devam eder.
  -- (Eşzamanlı çağrılar tavanı birkaç satır aşabilir; kesin sınır gerekmiyor.)
  if not exists (select 1 from public.kullanim_sayac k
                  where k.gun = v_gun and k.olay = p_olay and k.platform = p_platform)
     and (select count(*) from public.kullanim_sayac k where k.gun = v_gun) >= 500 then
    return;
  end if;
  insert into public.kullanim_sayac as k (gun, olay, platform, adet)
  values (v_gun, p_olay, p_platform, 1)
  on conflict (gun, olay, platform) do update set adet = k.adet + 1;
end;
$function$;

revoke execute on function public.kullanim_kaydet(text, text) from public;
grant execute on function public.kullanim_kaydet(text, text) to anon, authenticated;

-- ── 4) kvkk_onay: eklemeli günlük, sahtelenemez zaman/kaynak/tür ───────────
do $$
begin
  if to_regclass('public.kvkk_onay') is not null then
    revoke insert, update, delete, truncate on public.kvkk_onay from authenticated, anon;
    grant insert (user_id, tur, surum, onay, kaynak, kanit) on public.kvkk_onay to authenticated;

    drop policy if exists kvkk_onay_kendi_yazar on public.kvkk_onay;
    create policy kvkk_onay_kendi_yazar on public.kvkk_onay
      for insert with check (
        auth.uid() = user_id
        and tur = 'yurtdisi_ai'
        and kaynak = 'ayarlar'
        and surum ~ '^[0-9A-Za-z._-]{1,32}$'
        and (kanit is null or jsonb_typeof(kanit) = 'object')
      );
  end if;
end $$;

-- ── 5) case_id / client_id sahip denetimi ───────────────────────────────────
create or replace function public.fk_sahip_denetimi()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  a text;
  kolon text;
  ust text;
  yeni jsonb := to_jsonb(new);
  eski jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else null end;
  deger uuid;
  sahip uuid := nullif(yeni ->> 'owner_id', '')::uuid;
  bulundu boolean;
begin
  -- Sahipsiz satır (sunucu/servis yazımı) karşılaştırılamaz; kullanıcı yolu
  -- zaten RLS ile owner_id = auth.uid() ister.
  if sahip is null then
    return new;
  end if;
  foreach a in array tg_argv loop
    kolon := split_part(a, ':', 1);
    ust := split_part(a, ':', 2);
    if ust not in ('cases', 'clients') then
      raise exception 'fk_sahip_denetimi: bilinmeyen ust tablo %', ust;
    end if;
    deger := nullif(yeni ->> kolon, '')::uuid;
    if deger is null then
      continue;
    end if;
    -- UPDATE'te ne bağlantı ne sahip değiştiyse dokunma: bu göçten ÖNCE yazılmış
    -- satırlar denetimden kaçmış olabilir, ilgisiz bir güncelleme onları
    -- kilitlememeli.
    if eski is not null
       and (eski ->> kolon) is not distinct from (yeni ->> kolon)
       and (eski ->> 'owner_id') is not distinct from (yeni ->> 'owner_id') then
      continue;
    end if;
    execute format('select exists (select 1 from public.%I u where u.id = $1 and u.owner_id = $2)', ust)
      into bulundu using deger, sahip;
    if not bulundu then
      -- Var olmayan kimlikle AYNI kod: kimliğin başkasına ait olduğu sızmaz.
      raise exception 'ilgili kayit bulunamadi' using errcode = '23503';
    end if;
  end loop;
  return new;
end;
$function$;

revoke all on function public.fk_sahip_denetimi() from public, anon, authenticated;

do $$
declare
  r record;
  kolonlar text[];
begin
  for r in
    select * from (values
      ('case_expenses', array['case_id:cases']),
      ('case_installments', array['case_id:cases']),
      ('cases', array['client_id:clients']),
      ('client_advances', array['client_id:clients']),
      ('client_expenses', array['client_id:clients']),
      ('deadlines', array['case_id:cases']),
      ('documents', array['case_id:cases', 'client_id:clients']),
      ('enforcement_files', array['client_id:clients']),
      ('hearings', array['case_id:cases']),
      ('payment_promises', array['case_id:cases', 'client_id:clients']),
      ('payments', array['case_id:cases']),
      ('powers_of_attorney', array['client_id:clients'])
    ) v(tablo, args)
  loop
    kolonlar := array(select split_part(x, ':', 1) from unnest(r.args) x);
    if to_regclass('public.' || quote_ident(r.tablo)) is null
       or exists (
         select 1 from unnest(kolonlar || array['owner_id']) k(ad)
          where not exists (
            select 1 from information_schema.columns c
             where c.table_schema = 'public' and c.table_name = r.tablo and c.column_name = k.ad)) then
      raise notice 'fk_sahip_denetimi atlandi (tablo ya da sutun yok): %', r.tablo;
      continue;
    end if;
    execute format('drop trigger if exists fk_sahip_denetimi_t on public.%I', r.tablo);
    execute format(
      'create trigger fk_sahip_denetimi_t before insert or update of %s on public.%I '
      'for each row execute function public.fk_sahip_denetimi(%s)',
      array_to_string(kolonlar || array['owner_id'], ', '),
      r.tablo,
      (select string_agg(quote_literal(x), ', ') from unnest(r.args) x));
  end loop;
end $$;

-- ── 6) ai_saglayici_durum ve office_members ─────────────────────────────────
do $$
begin
  if to_regclass('public.ai_saglayici_durum') is not null then
    drop policy if exists ai_saglayici_durum_read on public.ai_saglayici_durum;
    create policy ai_saglayici_durum_read on public.ai_saglayici_durum
      for select to authenticated
      using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
  end if;

  if to_regclass('public.office_members') is not null and to_regclass('public.offices') is not null then
    drop policy if exists "office admin insert members" on public.office_members;
    create policy "office admin insert members" on public.office_members
      for insert with check (
        user_id = auth.uid()
        and exists (select 1 from public.offices o where o.id = office_members.office_id and o.owner_id = auth.uid())
      );
  end if;
end $$;

-- ── Doğrulama (TEK ifade — çok ifadeli dosyada yalnız sonuncu döner) ────────
-- "Uygulandı" ile "doğru oturdu" aynı şey değil: beklenen değer sağ sütunda.
select olcum, deger, beklenen from (
  select 1 as sira, 'profiles genel okuma politikasi' as olcum,
    (select count(*)::text from pg_policies
      where schemaname = 'public' and tablename = 'profiles'
        and policyname = 'profiles readable by authenticated') as deger, '0' as beklenen
  union all
  select 2, 'profiles kendi-okuma politikasi',
    (select count(*)::text from pg_policies
      where schemaname = 'public' and tablename = 'profiles'
        and policyname = 'profiles are self-readable'), '1'
  union all
  select 3, 'search_ictihat_fts tavan satiri',
    coalesce((select (position('least(greatest(coalesce(match_count' in p.prosrc) > 0)::text
       from pg_proc p where p.pronamespace = 'public'::regnamespace
        and p.proname = 'search_ictihat_fts'), 'YOK (!)'), 'true'
  union all
  select 4, 'kullanim_kaydet gunluk tavan',
    coalesce((select (position('>= 500' in p.prosrc) > 0)::text
       from pg_proc p where p.pronamespace = 'public'::regnamespace
        and p.proname = 'kullanim_kaydet'), 'YOK (!)'), 'true'
  union all
  select 5, 'kvkk_onay verildi_at INSERT yetkisi (authenticated)',
    (select count(*)::text from information_schema.column_privileges
      where table_schema = 'public' and table_name = 'kvkk_onay'
        and column_name = 'verildi_at' and privilege_type = 'INSERT'
        and grantee = 'authenticated'), '0'
  union all
  select 6, 'kvkk_onay UPDATE/DELETE yetkisi (authenticated)',
    (select count(*)::text from information_schema.role_table_grants
      where table_schema = 'public' and table_name = 'kvkk_onay'
        and grantee = 'authenticated' and privilege_type in ('UPDATE', 'DELETE')), '0'
  union all
  select 7, 'fk_sahip_denetimi_t tetikleyici sayisi',
    (select count(*)::text from pg_trigger where tgname = 'fk_sahip_denetimi_t'), '12 (canlida)'
  union all
  select 8, 'ai_saglayici_durum politikasi using(true) mi',
    coalesce((select (qual = 'true')::text from pg_policies
      where schemaname = 'public' and tablename = 'ai_saglayici_durum'
        and policyname = 'ai_saglayici_durum_read'), 'POLITIKA YOK (!)'), 'false'
  union all
  select 9, 'office_members insert with_check user_id = auth.uid() iceriyor mu',
    coalesce((select (with_check ilike '%user_id = auth.uid()%')::text from pg_policies
      where schemaname = 'public' and tablename = 'office_members'
        and policyname = 'office admin insert members'), 'POLITIKA YOK (!)'), 'true'
) ozet
order by sira;
