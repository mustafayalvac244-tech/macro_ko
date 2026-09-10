# Veri Koruma ve Yedekleme

Bu dosya, verinin nasıl korunduğunu ve **korunmadığı yerleri** dürüstçe yazar.
Uygulama avukatların müvekkil dosyalarını tutuyor; burada iyimser çerçeveleme
değil, gerçek durum lazım.

## Bugün ne var (denetlendi, çalışıyor)

| Katman | Durum | Kanıt |
|---|---|---|
| Günlük tablo yedeği | ✅ Çalışıyor | `backup.take_snapshot()` her gece 03:15; 21 tablo, 21 gün saklama. Son yedek canlıyla birebir (42 dava = 42 dava) |
| Aylık arşiv | ✅ Çalışıyor | `backup.take_monthly()` her ayın 1'i 04:00 |
| Belge envanteri | ✅ Yeni eklendi | `backup.take_file_inventory()` her gece 03:20 — dosya yolu, sahibi, boyutu, etag |
| **Geri yükleme** | ✅ **Yeni eklendi ve TEST EDİLDİ** | `backup.restore_missing()` — aşağıda |
| Yedeğin güvenliği | ✅ Sıkı | `backup` şeması yalnız `postgres`'e açık; REST üzerinden erişilemiyor (404/406 ile doğrulandı) |

### Geri yükleme nasıl kullanılır

Önce **prova** (hiçbir şey yazmaz, ne yapacağını söyler):

```sql
select * from backup.restore_missing('cases', '2026-09-07 03:15:00+00', true);
```

Sonucu doğruysa gerçeğini çalıştırın:

```sql
select * from backup.restore_missing('cases', '2026-09-07 03:15:00+00', false);
```

Güvenlik kilitleri: **yalnız silinmiş satırları geri koyar**, mevcut hiçbir
satırı ezmez/silmez; tek tablo, tek yedek anı; varsayılan prova modu; tekrar
çalıştırılırsa satır çoğaltmaz.

**Test edildi (uydurma değil, gerçek koşu):** test kaydı oluşturuldu → yedek
alındı → kayıt silindi → prova "1 satır gelecek" dedi ve yazmadı → gerçek
geri yükleme kaydı sahibiyle birlikte geri getirdi → tekrar çalıştırıldığında
0 satır ekledi (çoğaltmadı). Test verisi sonra temizlendi.

## Neyi KORUMAZ — açıkça

Mevcut yedek **aynı Supabase projesinin içinde** duruyor. Bu şunlara karşı
korur: yanlışlıkla silme, hatalı toplu güncelleme, uygulama hatası.
**Şunlara karşı KORUMAZ:**

1. **Projenin kendisinin kaybı.** Free plan projeleri hareketsizlikte
   duraklatılır; hesap kapanması, yanlışlıkla proje silme ya da faturalandırma
   sorunu olursa yedek de veriyle birlikte gider.
2. **Sağlayıcı/bölge arızası.** Veri `eu-west-1` (İrlanda) bölgesinde tek kopya.
3. **Hesap ele geçirilmesi.** Supabase hesabına erişen biri hem veriyi hem
   `backup` şemasını silebilir.
4. **Müvekkil belgelerinin kendisi.** `case-documents` kovasındaki gerçek
   dosyalar (PDF/görsel) yedeklenmiyor — yalnız **envanteri** tutuluyor. Yani
   bir kayıpta "şu 4 dosya, şu avukata ait, şu boyuttaydı" diyebiliriz ama
   dosyayı geri getiremeyiz.

Ayrıca Free planda **PITR (zaman noktasına dönüş) ve yönetilen otomatik yedek
YOK** — bu yüzden yukarıdaki kendi yedek sistemimiz kuruldu.

## Disk: uygulamayı durdurabilecek asıl risk (ölçüldü)

Free planda veritabanı **500 MB**'ı aşarsa proje **salt-okunur** moda geçer:
okuma çalışır ama yeni dava, müvekkil, duruşma, belge yükleme, kayıt olma ve
AI kullanımı dahil **hiçbir yazma işlemi olmaz**. Silmek boyutu anında
küçültmez (vacuum gerekir), yani çarptıktan sonra toparlanma da anlık değildir.

**Ölçüm anındaki durum:** 418 MB / 500 MB (%83,5). Büyümenin sebebi kullanıcı
verisi değil, arka plandaki içtihat hasadı: `ictihat_kararlar` tek başına
307 MB ve günde ~1.150 karar × ~34 kB ≈ **39 MB/gün** ekliyordu. Kalan 82 MB
ile **yaklaşık iki gün** kalmıştı.

**Alınan iki önlem:**

1. **Hasat yavaşlatıldı.** Üç hasat işi saatte 3 turdan **günde 1 tura**
   indirildi (72 kat azalma). Vektörleme saatlik bırakıldı — embedding'ler
   çok küçük ve hasadın gerisinde kalırsa anlamsal arama bozulur.
   Beklenen yeni büyüme ~0,5 MB/gün, yani **aylarca** alan. (Bu bir
   projeksiyon; gerçek hız birkaç gün sonra `pg_database_size` ile
   ölçülmeli.)
2. **Otomatik emniyet freni** (migration 0084). Veritabanı **460 MB**'ı
   aşarsa `hasat_tetikle` ve `vektorle_tetikle` isteği hiç göndermez —
   arka plan büyümesi kendiliğinden durur, kullanıcıların yazma işlemleri
   için alan kalır. Test edildi: eşik altında çalışıyor, eşik aşılmış gibi
   simüle edilince duruyor.

Kontrol etmek için:

```sql
select pg_size_pretty(pg_database_size(current_database())) as boyut,
       public.disk_musait_mi() as hasat_calisabilir;
```

## Öncelik sırasına göre yapılması gerekenler

**1. Proje DIŞINA kopya (en önemli).** Haftada bir `pg_dump` alıp projeden
bağımsız bir yere (kendi bilgisayarınız + bir bulut deposu) koymak, yukarıdaki
1-3 numaralı risklerin hepsini birden kapatır:

```bash
pg_dump "postgresql://postgres:<parola>@db.wjshlysfmeqlnfiibknj.supabase.co:5432/postgres" \
  --no-owner --format=custom --file="vekil-$(date +%F).dump"
```

Dosya müvekkil verisi içerir: **şifreli diskte saklayın**, e-postayla
göndermeyin, herkese açık bir depoya (GitHub dahil) koymayın.

**2. Müvekkil belgelerinin kopyası.** Storage kovasını düzenli olarak dışarı
senkronlayın (`rclone`, `supabase storage cp -r` ya da S3 uyumlu bir hedefe).
Dosyalar en telafisi zor veridir: bir dava dosyası kaybolursa yeniden
üretilemez.

**3. Supabase Pro'ya geçiş (aylık ~25$).** Getirdikleri: yönetilen günlük
yedek + 7 günlük PITR, sızmış parola koruması (HIBP — şu an Free planda
açılamıyor, denendi ve 402 döndü), daha yüksek kaynak sınırları. Ücretli AI
katmanı satılmaya başlandığında bu maliyet zaten kendini karşılar.

**4. Geri yükleme tatbikatı.** Yedek, ancak geri yüklendiği kanıtlandığında
yedektir. `restore_missing` test edildi; ayda bir, gerçek bir tabloda prova
modunu çalıştırmak iyi bir alışkanlık olur.

## Not: veri nerede duruyor

Veri `eu-west-1` (İrlanda) bölgesinde. Türkiye'deki müvekkil verisinin yurt
dışında işlenmesi KVKK açısından ayrı bir değerlendirme konusudur (açık rıza /
yeterlilik kararı / taahhütname). Bu teknik bir açık değil ama bir hukuk
uygulaması için farkında olunması gereken bir başlık — kendi
değerlendirmenizi yapmanız gerekir.
