-- YEDEKLEME SİSTEMİNİN İKİ EKSİĞİ: GERİ YÜKLEME YOK, DOSYALAR YEDEKLENMİYOR.
--
-- MEVCUT DURUM (denetlendi, çalışıyor): backup.take_snapshot() her gece 03:15'te
-- 21 tabloyu jsonb olarak backup.snapshots'a yazıyor, 21 gün saklıyor. Son 21
-- günün hepsi mevcut, son yedek canlı veriyle birebir (42 dava = 42 dava).
-- backup şeması yalnız postgres'e açık; REST üzerinden erişilemiyor (404/406
-- ile doğrulandı). Buraya kadar sağlam.
--
-- EKSİK 1 — GERİ YÜKLEME YOLU YOKTU. Var olan tek fonksiyon restore_preview,
-- yalnızca "hangi tarihte kaç satır var" diye LİSTELİYOR. Yani veri alınıyor
-- ama GERİ KONULAMIYORDU. Test edilmemiş ve geri yüklenemeyen bir yedek,
-- yedek değil sadece depolamadır.
--
-- EKSİK 2 — MÜVEKKİL BELGELERİ (storage) HİÇ YEDEKLENMİYOR. take_snapshot
-- yalnız Postgres tablolarını alıyor; documents tablosu belgenin KAYDINI
-- tutuyor ama dosyanın KENDİSİ (case-documents kovası) yedeklenmiyor. Dosyanın
-- ikizini veritabanına koymak doğru değil (boyut/maliyet), ama en azından
-- ENVANTERİNİ tutmak şart: bir kayıp yaşanırsa neyin kaybolduğu tam olarak
-- bilinsin, kullanıcıya "şu 12 belge gitti" diyebilelim.

-- ── 1) GERİ YÜKLEME ─────────────────────────────────────────────────────────
/**
 * Bir tablonun SİLİNMİŞ satırlarını, seçilen yedek anından geri koyar.
 *
 * GÜVENLİK KİLİTLERİ (bilinçli olarak dar tutuldu):
 *  • YALNIZ EKLER. Canlıda BULUNMAYAN (birincil anahtarı eşleşmeyen) satırları
 *    ekler; var olan hiçbir satırı GÜNCELLEMEZ, SİLMEZ, EZMEZ. En sık gerçek
 *    ihtiyaç budur: "yanlışlıkla sildim, geri gelsin".
 *  • VARSAYILAN PROVA (p_dry_run = true). Ne yapacağını söyler, yapmaz.
 *    Gerçekten yazmak için açıkça false geçilmelidir.
 *  • Tek tablo, tek yedek anı. Toplu/otomatik geri yükleme yok.
 *  • Üretilen (generated) kolonlar dışlanır — aksi hâlde INSERT hata verirdi
 *    (ör. finance_entries.net_total/vat_amount).
 *  • Bileşik birincil anahtarları destekler (ör. office_members).
 *
 * Dönen: (eklenen satır sayısı, prova mıydı) — prova modunda "eklenecek" sayı.
 */
create or replace function backup.restore_missing(
  p_tbl text,
  p_snap timestamptz,
  p_dry_run boolean default true
)
returns table(satir integer, prova boolean)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  kolonlar text;
  pk_kosul text;
  sql text;
  n integer := 0;
begin
  -- Yalnız yedeklenen tablolar hedeflenebilir: rastgele bir tablo adıyla
  -- çağrılıp beklenmedik bir yere yazılmasın.
  if not exists (select 1 from backup.snapshots s where s.tbl = p_tbl) then
    raise exception 'yedekte böyle bir tablo yok: %', p_tbl;
  end if;
  if not exists (select 1 from backup.snapshots s where s.tbl = p_tbl and s.snap_at = p_snap) then
    raise exception 'bu tabloya ait % anında yedek yok', p_snap;
  end if;

  -- Yazılabilir kolonlar (üretilen kolonlar hariç).
  select string_agg(quote_ident(a.attname), ', ' order by a.attnum)
    into kolonlar
  from pg_attribute a
  where a.attrelid = ('public.' || quote_ident(p_tbl))::regclass
    and a.attnum > 0 and not a.attisdropped and a.attgenerated = '';

  -- Birincil anahtar karşılaştırması jsonb üzerinden yapılır: tip dönüşümü
  -- gerektirmez, uuid/text/int hepsinde doğru çalışır.
  select string_agg(format('to_jsonb(t) -> %L = s.row_data -> %L', a.attname, a.attname), ' and ')
    into pk_kosul
  from pg_index i
  join lateral unnest(i.indkey) with ordinality k(attnum, ord) on true
  join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum
  where i.indrelid = ('public.' || quote_ident(p_tbl))::regclass and i.indisprimary;

  if pk_kosul is null then
    raise exception 'birincil anahtarı olmayan tablo geri yüklenemez: %', p_tbl;
  end if;

  sql := format(
    'insert into public.%I (%s) select %s from backup.snapshots s
       cross join lateral jsonb_populate_record(null::public.%I, s.row_data) as r
      where s.tbl = %L and s.snap_at = %L
        and not exists (select 1 from public.%I t where %s)',
    p_tbl, kolonlar,
    (select string_agg('r.' || quote_ident(a.attname), ', ' order by a.attnum)
       from pg_attribute a
      where a.attrelid = ('public.' || quote_ident(p_tbl))::regclass
        and a.attnum > 0 and not a.attisdropped and a.attgenerated = ''),
    p_tbl, p_tbl, p_snap, p_tbl, pk_kosul
  );

  if p_dry_run then
    -- Prova: aynı koşulla yalnız SAYAR, yazmaz.
    execute format(
      'select count(*)::int from backup.snapshots s
        where s.tbl = %L and s.snap_at = %L
          and not exists (select 1 from public.%I t where %s)',
      p_tbl, p_snap, p_tbl, pk_kosul
    ) into n;
  else
    execute sql;
    get diagnostics n = row_count;
  end if;

  return query select n, p_dry_run;
end;
$$;

revoke all on function backup.restore_missing(text, timestamptz, boolean) from public, anon, authenticated;

-- ── 2) BELGE (STORAGE) ENVANTERİ ────────────────────────────────────────────
create table if not exists backup.dosya_envanteri (
  id bigserial primary key,
  snap_at timestamptz not null default now(),
  yol text not null,
  sahip uuid,
  boyut bigint,
  etag text,
  guncellendi timestamptz
);

create index if not exists dosya_envanteri_snap_idx on backup.dosya_envanteri (snap_at);

/**
 * case-documents kovasındaki dosyaların envanterini alır. Dosyanın KENDİSİNİ
 * değil, kimliğini (yol, sahip, boyut, etag) saklar — bir kayıp durumunda
 * neyin kaybolduğu satır satır bilinsin diye. Gerçek dosya yedeği için
 * proje DIŞINA kopya gerekir (bkz. YEDEKLEME.md).
 */
create or replace function backup.take_file_inventory()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare n integer := 0;
begin
  insert into backup.dosya_envanteri (yol, sahip, boyut, etag, guncellendi)
  select o.name,
         nullif((storage.foldername(o.name))[1], '')::uuid,
         (o.metadata->>'size')::bigint,
         o.metadata->>'eTag',
         o.updated_at
  from storage.objects o
  where o.bucket_id = 'case-documents';
  get diagnostics n = row_count;

  -- Envanter de 21 gün saklanır (anlık görüntülerle aynı pencere).
  delete from backup.dosya_envanteri where snap_at < now() - interval '21 days';
  return n;
end;
$$;

revoke all on function backup.take_file_inventory() from public, anon, authenticated;
