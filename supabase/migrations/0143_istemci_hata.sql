-- İSTEMCİ HATA KAYDI — çökmeyi tahminle değil kayıtla çözmek için
-- ===========================================================================
--
-- NEDEN VAR — 16.09.2026, GERÇEK BİR OLAYDAN DOĞDU.
--
-- Ürün sahibi bir iPhone'da "Vekil Pro Çöktü" ekran görüntüsü gönderdi:
-- güncelleme sonrası çökmüş, Android'de hiç çökmemiş. Çökmeyi araştırırken
-- ASIL ARIZA ortaya çıktı: elimizde hiçbir kayıt yok.
--
--   src/components/ErrorBoundary.tsx > componentDidCatch
--       console.error('Uncaught UI error:', error)
--
-- Hepsi bu. Gerçek bir cihazda `console.error` HİÇBİR YERE gitmiyor —
-- geliştirici konsolu yok, kimse okumuyor. Yani uygulama çöküyor ve arkasında
-- okuyabileceğimiz tek bir satır bırakmıyor. Her çökme bir tahmin oyununa
-- dönüşüyor; bu oturumda tam olarak öyle oldu.
--
-- ÜÇ KÖR NOKTA ÖLÇÜLDÜ (kod okunarak, 16.09.2026):
--   1) ErrorBoundary yalnız konsola yazıyor          → hiçbir yere ulaşmıyor
--   2) Modül seviyesinde kod ErrorBoundary'den ÖNCE koşuyor
--      (örn. themeStore.ts:19 `temaTokenlariniUygula(ACILIS_TEMASI)`).
--      Orada atılan bir hatayı hiçbir sınır yakalayamaz — React daha
--      başlamamıştır.
--   3) Effect içindeki hatalar sınırın SARDIĞI ağacın dışında kalıyor —
--      bu zaten biliniyordu, src/lib/purchases.ts:52'de yazılı.
--
-- BU TABLO ÇÖKMEYİ ÖNLEMEZ. Çökmeyi GÖRÜNÜR yapar. Fark önemli: bir sonraki
-- çökmede ürün sahibinden ekran görüntüsü ve Ayarlar'dan kayıt çıkarmasını
-- istemek yerine tek bir SQL sorgusu yeter.
--
-- ── NE SAKLANIR, NE SAKLANMAZ ─────────────────────────────────────────────
--
-- SAKLANIR : hata mesajı, yığın izi (stack), ekran yolu, platform, sürüm,
--            çalışma zamanı sürümü, güncelleme kimliği.
-- SAKLANMAZ: kullanıcının yazdığı metin, dilekçe içeriği, müvekkil bilgisi.
--
-- `mesaj` ve `yigin` kullanıcı verisi TAŞIYABİLİR mi? Teoride evet — bir hata
-- mesajı içine değişken basılmış olabilir. Bu yüzden iki önlem:
--   • Sütunlar kırpılıyor (mesaj 500, yigin 4000) — uzun bir dosya metni
--     kazara girse bile tamamı gitmez.
--   • RLS: kullanıcı KENDİ kaydını yazar, KENDİ kaydını okur. Toplu okuma
--     yalnız service_role'da. Yani bir kullanıcının hatası başka bir
--     kullanıcıya asla görünmez.
-- Tam güvence istenirse mesaj da kırpılabilir; ama o zaman teşhis değeri
-- düşer ve tablo kurulma amacını yitirir. Bu takas bilinçli.

create table if not exists public.istemci_hata (
  id uuid primary key default gen_random_uuid(),

  -- NULLABLE ve auth.users'a bağlı DEĞİL: en değerli çökme, kullanıcı henüz
  -- giriş yapmamışken açılışta olandır. owner_id zorunlu olsaydı tam da
  -- yakalamak istediğimiz çökmeyi kaydedemezdik.
  owner_id uuid references public.profiles (id) on delete set null,

  mesaj text not null,
  yigin  text,
  -- 'render' | 'effect' | 'global' | 'promise'
  kaynak text not null,
  ekran  text,
  platform text,
  uygulama_surumu text,
  -- expo-updates: hangi çalışma zamanı ve hangi güncelleme paketi koşuyordu.
  -- "Güncelleme sonrası çöktü" iddiasını DOĞRULAYAN ya da ÇÜRÜTEN sütun bu.
  calisma_surumu text,
  guncelleme_id text,

  olusturuldu timestamptz not null default now()
);

create index if not exists istemci_hata_zaman_idx
  on public.istemci_hata (olusturuldu desc);
create index if not exists istemci_hata_surum_idx
  on public.istemci_hata (platform, uygulama_surumu, olusturuldu desc);

alter table public.istemci_hata enable row level security;

-- YAZMA: giriş yapmış kullanıcı kendi adına; owner_id null da olabilir
-- (açılış çökmesi). Başkasının adına yazamaz.
drop policy if exists "istemci hata insert" on public.istemci_hata;
create policy "istemci hata insert" on public.istemci_hata
  for insert to authenticated
  with check (owner_id is null or auth.uid() = owner_id);

-- OKUMA: yalnız kendi kayıtları. Toplu teşhis service_role ile yapılır.
drop policy if exists "istemci hata select" on public.istemci_hata;
create policy "istemci hata select" on public.istemci_hata
  for select to authenticated
  using (auth.uid() = owner_id);

-- UPDATE/DELETE politikası YOK = yasak. Hata kaydı sonradan
-- değiştirilebilirse teşhis değeri kalmaz.

comment on table public.istemci_hata is
  'İstemci tarafı çökme/hata kaydı. 16.09.2026''da bir iPhone çökmesi '
  'araştırılırken kuruldu: ErrorBoundary yalnız console.error yazıyordu ve '
  'gerçek cihazda o hiçbir yere gitmiyordu. Kullanıcı metni SAKLANMAZ.';
