# Yedekleme ve Geri Yükleme (ücretsiz kurulum)

Supabase **Free** planında otomatik yedek ve PITR **yoktur**. Para harcamadan
iki katmanlı koruma kuruldu.

---

## Katman 1 — Veritabanı içi günlük anlık görüntü ✅ (kurulu, çalışıyor)

**Neye karşı korur:** yanlış silme, hatalı toplu güncelleme, bozuk migration,
uygulama hatası. Yani en sık yaşanan felaketler.

- Her gece **03:15 UTC (TR 06:15)** `pg_cron` ile otomatik çalışır
- 21 kullanıcı tablosunun tamamı `backup.snapshots` tablosuna JSON olarak yazılır
- **21 gün** saklanır, eskiler otomatik silinir
- `backup` şeması API'ye kapalıdır (dışarıdan erişilemez)

### Elle yedek alma
```sql
select backup.take_snapshot();
```

### Hangi yedekler var?
```sql
select * from backup.restore_preview('cases');
-- snap_at | satir_sayisi
```

### Geri yükleme (örnek: cases tablosu)
> Önce **mutlaka** mevcut tabloyu bir yere kopyala; geri yükleme üzerine yazar.

```sql
-- 1) Güvenlik kopyası
create table public.cases_kurtarma_oncesi as select * from public.cases;

-- 2) Belirli bir anlık görüntüden geri yükle (snap_at'i yukarıdan al)
insert into public.cases
select * from jsonb_populate_recordset(
  null::public.cases,
  (select jsonb_agg(row_data) from backup.snapshots
    where tbl = 'cases' and snap_at = '2026-07-28 12:00:00+00')
)
on conflict (id) do nothing;   -- sadece kaybolanları geri getirir
```

Aynı yöntem `clients`, `hearings`, `deadlines`, `finance_entries` vb. için de geçerlidir.

**Sınırı:** Proje tamamen silinir/kaybolursa bu katman da gider. Bunun için Katman 2 var.

---

## Katman 2 — Dışarı şifreli yedek (GitHub Actions) ⚙️ 3 ayar gerekiyor

**Neye karşı korur:** projenin tamamen kaybı, hesap kapanması, bölge arızası.

Her gün Supabase'ten tüm kullanıcı verisi çekilir, **AES-256 ile şifrelenir** ve
GitHub artefaktı olarak **90 gün** saklanır. Ücretsizdir.

### Kurulum (bir defalık, ~3 dakika)
GitHub → repo → **Settings → Secrets and variables → Actions → New repository secret**
ile şu üç değeri ekle:

| Secret adı | Değer |
|---|---|
| `SUPABASE_URL` | `https://wjshlysfmeqlnfiibknj.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase → Settings → **API** → `service_role` anahtarı |
| `BACKUP_PASSPHRASE` | Uzun bir parola (ör. 4-5 rastgele kelime) — **KAYBETME** |

> `service_role` anahtarı tüm veriyi okur; yalnız GitHub Secrets içinde tut,
> hiçbir yere yapıştırma. `BACKUP_PASSPHRASE` kaybolursa yedekler açılamaz.

### Çalıştırma
- Otomatik: her gün 02:40 UTC (TR 05:40)
- Elle: GitHub → **Actions → "Günlük Yedek (ücretsiz)" → Run workflow**

### Yedeği indirme ve açma
1. GitHub → Actions → ilgili çalıştırma → **Artifacts** → `.tar.gz.enc` dosyasını indir
2. Çöz:
```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -in vekil-backup-20260728.tar.gz.enc -out backup.tar.gz \
  -pass pass:'PAROLANIZ'
mkdir -p geri && tar -xzf backup.tar.gz -C geri
ls geri     # cases.json, clients.json, hearings.json ... _manifest.json
```
3. JSON'lar Supabase'e geri yüklenebilir (tablo başına `jsonb_populate_recordset`
   ya da REST ile toplu insert).

---

## Ne zaman ücretli plana geçmeli?

Bu kurulum lansman ve ilk kullanıcılar için yeterlidir. Ancak:

- Kullanıcı sayısı artınca (veri > ~200 MB) anlık görüntüler Free plandaki
  disk alanını zorlayabilir → saklama süresini 21 günden düşür ya da Pro'ya geç
- **Ücretli üye almaya başlayınca** Supabase Pro (~$25/ay) önerilir:
  gerçek PITR ile **dakika hassasiyetinde** geri dönüş sağlar; bu kurulum
  ise **günlük** hassasiyettedir (son yedekten sonraki değişiklikler kaybolur).
