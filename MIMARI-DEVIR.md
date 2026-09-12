# Başka bir projeye devir notu — kurulum ve alışkanlıklar

Bu dosya **başka bir sohbete yapıştırılmak** üzere yazıldı. Vekil Pro'da
çalışan yapıyı ve —daha önemlisi— **pahalıya öğrenilmiş hataları** anlatır.
Alan adı hukuk; aşağıdakilerin neredeyse tamamı alandan bağımsızdır.

Vekil Pro'nun verisine, anahtarına ya da altyapısına erişim **gerekmez ve
verilmez**. Devredilen şey bilgi.

---

## Yığın

| Katman | Seçim | Neden |
|---|---|---|
| Uygulama | **Expo (SDK 57) + React Native** | Tek koddan iOS + Android + web. Web'i ayrıca yazmıyorsunuz. |
| Yönlendirme | **expo-router** | Dosya adı = rota. `app/kvkk.tsx` → `/kvkk`. |
| Arka uç | **Supabase** | Postgres + Auth + Storage + Edge Functions tek yerde. |
| Sunucu kodu | **Supabase Edge Functions (Deno)** | Gizli anahtar isteyen her şey burada. |
| Zamanlanmış işler | **pg_cron + pg_net**, veritabanının İÇİNDE | Dış zamanlayıcı yok, ek secret yok. |
| Dağıtım | **GitHub Actions** | Migration, edge dağıtımı, OTA, raporlar — hepsi tek tıkla. |
| Mobil güncelleme | **EAS Update (OTA)** | Mağaza incelemesi beklemeden düzeltme. |
| Web barındırma | **GitHub Pages** (`docs/`) | Ücretsiz. Ama ağır trafik için değil. |

---

## Pahalıya öğrenilenler — asıl değer burada

### 1. RLS'i baştan sıkı kur, sonra gevşetme

Ağ geçidinin `verify_jwt` ayarı **yalnız "geçerli bir jeton var mı"** der,
**kimin** olduğunu sormaz. Bakım uçlarımızda bu tek koruma vardı ve kayıtlı
**herhangi bir kullanıcı** onları tetikleyebiliyordu.

Doğrusu: hassas tabloda

```sql
revoke all on public.tablo from anon, authenticated;
```

ve erişimi `security definer` fonksiyonlarla ver. Yetki kontrolünü de
"anahtarı karşılaştır" diye yazmayın — bizde iki ayrı anahtar biçimi bir arada
yaşıyordu (eski JWT 219 karakter, yeni `sb_secret_` 41) ve karşılaştırma
zamanlanmış işi **sessizce** bozuyordu. Yalnız `service_role`'ün
çalıştırabildiği yan etkisiz bir fonksiyonu çağırın: yetkisizde Postgres **net
bir hata** verir (42501), boş sonuç değil.

> "Politikasız bir tabloyu okumayı dene" yaklaşımı da **yanlış**: RLS satırları
> **filtreler**, hata döndürmez. Anon anahtarıyla sorgu hatasız ve boş döner,
> kontrol onu yetkili sayar.

### 2. `create or replace` yeni argüman ekleyince DEĞİŞTİRMEZ

Varsayılanlı üçüncü bir argüman eklerseniz Postgres bunu **aşırı yük** sayar,
eskisi durur. O andan sonra iki argümanlı çağrı **belirsizleşir** ve o yolu
kullanan zamanlanmış iş sessizce durur. Önce `drop function ... (eski imza)`,
sonra yarat — ve **grant'leri yeniden verin**, düşürmek onları da siler.

### 3. Ölçüm aletinizi de test edin

Bizde arka plan işleri `pg_net` ile çağrılıyor ve yanıtlar
`net._http_response`'ta birikiyor. **Bu tabloda hangi işlevin yanıtı olduğu
yazmıyor.** Rapor sorgumuz süzgeç koymadığı için **tüm** trafiği "hasat turu"
sayıyordu; ayrıca hata testi dar yazılmıştı ve sert hatalar "boş tur" kovasına
düşüyordu.

Sonuç: üç tur boyunca **var olmayan bir sorunu** kovaladık. Gerçek sorun
bambaşkaydı — çağrıların yarısı hiç iş yapmadan düşüyordu.

**Ders:** arka plan işine daha ilk günden **kendi kimliğini** yazdırın (istek
kimliğini bir tabloya kaydedin), yoksa ölçümünüz yalan söyler ve siz ona
inanırsınız.

### 4. Emniyet freni, kullanıcının tetiklediği yazmayı da kapsasın

Disk eşiği için `disk_musait_mi()` yazdık ve arka plan işleri çağırıyordu. Ama
**ikinci bir yazma yolu** vardı: kullanıcı araması da kayıt ekliyordu ve fren
onu hiç kapsamıyordu. Birkaç test araması iki dakikada 52 kayıt ekledi.

Eşik aşılırsa **hizmet durmamalı**, yalnız **arşivleme** atlanmalı.

### 5. Sessiz ölü düğme

`Button` bileşeni `disabled` iken `onPress`'te erken dönüyordu. Doğrulamaya
bağlı `disabled` ile birleşince: **basıyorsunuz, hiçbir şey olmuyor, hiçbir şey
de yazmıyor.** Üç ekranda vardı.

Kural: **doğrulama için düğmeyi kilitlemeyin.** Bastırın ve **sebebi söyleyin**.

### 6. Ağır şeyi modül seviyesinde yükleyip sık çağırmayın

Gömme işlevimiz modül kapsamında bir model yüklüyordu ve cron **dakikada bir**
çağırıyordu. 6 saatte 360 denemenin **285'i** `WORKER_RESOURCE_LIMIT` ile
öldü. Üstelik işlev gövdedeki parti boyunu 6'ya kırpıyordu, cron 15
gönderiyordu — istenen değer **hiç uygulanmıyordu**.

### 7. Dış kaynağı kullanıcının yoluna koyacaksanız

Kamuya açık bir servisi çağırıyorsanız: **sıkı zaman aşımı**, **tekrar yok**
(tekrar, bekleyen kullanıcının süresini katlar), **devre kesici** (ölü kaynağı
her istekte yeniden yoklamayın) ve **hata atmayan** bir sarmalayıcı. En kötü
hâlde eksik veriyle cevap verin, cevabı düşürmeyin.

Arka plan toplama işiniz varsa **kullanıcı saatlerinde onu kısın**: ikisi aynı
hız bütçesini paylaşır. Bizde çakışma `429` ve TLS zaman aşımı üretti.

### 8. Türkçe metin tuzakları

- Python `'GEÇİCİ'.title()` → `'Geçi̇ci̇'` (birleşik nokta); `'Geçici'.upper()`
  → `'GEÇICI'` (noktasız I). Karşılaştırmadan önce ASCII'ye indirgeyin.
- Postgres'te `tsvector` sütunu, türetildiği metnin **birkaç katı** yer
  kaplayabilir. Bizde iki tsvector sütunu + GIN indeksleri tablonun **%68,6**'sı;
  asıl metin yalnız **%13,6**. Diski ölçmeden "metni taşıyalım" demeyin.

### 9. Dürüst ölçüm disiplini

- Puan **yalnız ölçüm değişince** değişir. Kod yazmak puanı yükseltmez.
- "Ölçülmemiş tahmin → ölçüm" geçişini **ilerleme** diye sunmayın. Doğrusu
  "hiç ölçülmemişti, ilk ölçüm şu".
- Kanıtın kaynağını söyleyin: gerçek kullanıcı verisi > deterministik ölçüm >
  birkaç denemelik gözlem.
- Bir iki denemeyi "doğrulandı" diye yazmayın.

---

## Bir ECZANE uygulaması için ek uyarılar

### Sağlık verisi ÖZEL NİTELİKLİDİR — çıta çok daha yüksek

KVKK **m.6**: sağlık verisi özel nitelikli kişisel veridir. Reçete, ilaç
geçmişi, hasta kimliği bu kapsamdadır ve:

- işlenmesi kural olarak **açık rıza** ister (ya da kanunun saydığı dar
  istisnalar — sır saklama yükümlüsü sağlık personeli eliyle işleme gibi),
- **yeterli önlem** alınması zorunludur (Kurul kararlarıyla belirlenmiş),
- **VERBİS kayıt yükümlülüğü**, özel nitelikli veri işleyenlerde çalışan
  sayısı/ciro eşiklerinden **bağımsız olarak** doğabilir.

Bir hukuk uygulamasında bunlar zaten ağırdı; eczanede daha ağır. **Tasarıma
sonradan eklenecek bir şey değil.** Baştan:

- hangi alanın özel nitelikli olduğunu şemada işaretleyin,
- açık rızayı **ekleme-yalnızca (append-only) bir günlükte** tutun — rıza bir
  delildir, üzerine yazmak delili yok etmektir,
- rızanın geri alınması **hizmetin kalanını durdurmasın** (rıza, hizmetin şartı
  hâline getirilemez),
- yurt dışına aktarım varsa (yapay zekâ sağlayıcıları, analiz servisleri) bunu
  **ayrı** ve **açıkça** sorun.

### Yapay zekâya veri gönderiyorsanız

Gizlilik metninde "hiçbir veri paylaşılmaz" yazıp aynı anda kullanıcı metnini
ABD'li bir modele göndermek **yanlış beyandır**. Bizde tam olarak bu oldu ve
düzeltildi. Aktarılan tarafları **koddan okuyarak** listeleyin, elle yazıp
unutmayın.

### Kaynak veri

Eczane tarafının içtihat karşılığı **ilaç/barkod/SGK ödeme listeleri**dir.
Aynı iki katman mantığı işe yarar: **künye/üstveri her şey için** (ucuz),
**detay talep geldikçe** (pahalı). Ama önce kaynağın koşullarına bakın —
içtihat kamuya açıktı; ilaç veri tabanlarının bir kısmı **lisanslıdır**.
Kazımadan önce kullanım şartlarını okuyun.

---

## İlk gün kurulum sırası

1. Supabase projesi + **bölge seçimi** (KVKK'da yurt dışına aktarım bunun
   üstüne kurulur; sonradan taşımak zor).
2. `supabase/migrations/NNNN_ad.sql` — **eklemeli**, elle SQL çalıştırmayın.
3. Migration'ı uygulayan **GitHub Actions iş akışı** (secret: Supabase erişim
   jetonu). Elle uygulama = kimsenin bilmediği şema.
4. **Salt okunur rapor koşturucu**: `scripts/*.sql` dosyalarını çalıştıran, ama
   içinde `insert|update|delete|drop|alter|create|grant` geçerse **reddeden**
   bir betik. Ölçüm elle yapıştırmaya bağlı kalırsa hiç alınmaz.
5. RLS'i **her tabloda** aç, politikaları yaz, `anon`dan yetkiyi al.
6. Edge işlevleri için yetki kontrolünü **tek bir paylaşılan dosyada** yaz.
7. Emniyet freni (disk/kota) + onu **her** yazma yolunda çağır.

---

## Asla yapılmayacaklar

- `service_role` / `sb_secret_...` anahtarını depoya, sohbete, başka projeye
  **koymayın**. RLS'i baypas eder.
- Mağaza imza anahtarlarını (`.p8` vb.) ve webhook gizli anahtarlarını
  paylaşmayın. `appl_` / `goog_` ile başlayan **genel** anahtarlar güvenlidir.
- Kullanıcıya programın kendisini değiştirme yetkisi vermeyin.
- Ölçmediğiniz bir şeye puan vermeyin.
