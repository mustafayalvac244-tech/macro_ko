# İçtihat Havuzu — Sürekli Güçlenen Karar Veritabanı

Kaynak: **UYAP Emsal** (emsal.uyap.gov.tr) — Yargıtay, Danıştay, BAM/BİM
kararlarının kamuya açık resmi bankası. Kararlar kamusal veridir.

Mimari: kararları kendi `ictihat_kararlar` havuzumuza biriktiririz; arama
**önce havuzda** yapılır (hızlı, semantik, kota yok), eksik kalırsa **canlı
Emsal** ile tamamlanır. Havuz büyüdükçe canlı bağımlılık azalır, güç artar.

```
Harvester (cron) ──> UYAP Emsal ──> ictihat_kararlar (metin + embedding)
                                          │
App ──> ictihat (Edge Fn) ──> havuz araması (semantik+FTS) ──(eksikse)──> canlı Emsal
```

## Kurulum (evde, tek sefer)

### 1) Veritabanı
`KURULUM.sql` içindeki **0026** bölümünü Supabase SQL Editor'da çalıştır.
(pgvector eklentisi + `ictihat_kararlar` + `ictihat_harvest_state` +
`search_ictihat_fts` / `match_ictihat_semantic` fonksiyonları.)

### 2) Edge Function
```bash
supabase functions deploy ictihat
# (embedding/özet için, faturalı anahtar):
supabase secrets set GEMINI_API_KEY=<anahtar>
```

### 3) Otomatik hasat (GitHub Actions)
Repo → **Settings → Secrets and variables → Actions** altına ekle:
- `SUPABASE_URL` = `https://<proje>.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` = Supabase **service_role** anahtarı

> **DÜZELTME (18.09.2026).** Burada eskiden `GEMINI_API_KEY` = "faturalı
> anahtar → embedding üretir" yazıyordu. **Yanlış ve pahalıya mal olabilecek
> bir yanlıştı:** embedding, Supabase edge çalışma zamanının YERLEŞİK
> `gte-small` modeliyle üretiliyor (bkz. `supabase/functions/embed-ictihat`).
> Ücretsizdir, API anahtarı istemez, sunucuda çalışır. Bu satırı okuyup
> "semantik arama için ücretli anahtar lazım" diye karar vermek, olmayan bir
> engel icat etmek olurdu.

> **DÜZELTME (18.09.2026).** Burada eskiden "`harvest-ictihat.yml` her 3
> saatte bir otomatik çalışır" yazıyordu. Çalışmıyor: zamanlama dosyadan
> kaldırıldı (sebebi dosyanın kendi başlığında yazılı) ve hasat artık
> Supabase içindeki **pg_cron** ile dönüyor. Bu iş akışı yalnız ELLE
> tetiklenir: **Actions → İçtihat Hasadı → Run workflow**.

## Elle çalıştırma (yerel test)
```bash
cd scripts
npm install
# gerçek yazma:
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... GEMINI_API_KEY=... node harvest-ictihat.mjs
# sadece tara, DB'ye yazma:
HARVEST_DRY=1 HARVEST_MAX=6 node harvest-ictihat.mjs
```

Ayarlar (env): `HARVEST_MAX` (çalışma başına yeni karar, vars. 400),
`HARVEST_TERMS` (terim sayısı, vars. 10), `HARVEST_PAGE_SIZE` (vars. 20).

## Havuzu genişletmek
`scripts/ictihat-terms.txt` dosyasına yeni arama terimi ekle → sonraki
hasatta o alandaki kararlar da toplanmaya başlar. Harvester her terimi
kaldığı sayfadan sürdürür; tüm sayfalar taranınca başa dönüp güncellemeleri
yakalar.

## Notlar
- **Embedding ücretsizdir ve anahtar istemez.** Supabase edge çalışma
  zamanının yerleşik `gte-small` modeli (384 boyut) kullanılıyor.
- **Vektörleme pg_cron ile dönüyor, paralel işçilerle.** 18.09.2026'da
  ölçülen arıza: tek işçi 3 dakikada bir 6 kayıt istiyordu ve çağrıların
  **%100'ü** `WORKER_RESOURCE_LIMIT` ile düşüyordu. Kayıtlar tek tek
  yazıldığı için çöküşten önce yazılanlar kalıyor ve arıza "yavaş çalışıyor"
  gibi görünüyordu. Yığın 3'e indirildi, işçiler paralelleştirildi ve her
  işçiye ayrık bir `atla` (offset) penceresi verildi.
  Ölçülen hız: **68/saat → ~1.150/saat** (bkz. göç 0144, 0145, 0146).
- **Vektörsüz karar anlamsal aramada GÖRÜNMEZ.** Bu yüzden hasat hızıyla
  vektörleme hızı birlikte izlenmeli; hasat öndeyse arama kalitesi sessizce
  geriler.
- **Geo/IP:** UYAP bazı yabancı IP'leri kısıtlayabilir. Hasadı GitHub
  Actions çalıştırır; engel görülürse TR-dostu bir runner/relay'e alınır.
- Nazik hız: istekler arası gecikme vardır; kaynağı yormaz.
