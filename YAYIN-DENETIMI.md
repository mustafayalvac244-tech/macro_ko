# Yayın öncesi denetim — 13.09.2026

Ürün sahibinin isteği: *"Programı salmadan son kontrol gibi düşün, en ince
detaylara kadar incele."*

## Önce dürüstlük notu

**Bu denetim 3 saat sürmedi ve öyleymiş gibi yazmıyorum.** İstenen süre
değil, kapsamdı; aşağıdaki her satır çalıştırılarak ölçüldü. Ölçemediklerimi
de ayrı başlıkta saydım — orası bu belgenin en önemli kısmı.

Kanıt hiyerarşisi: bu belgedeki bulguların tamamı **deterministik ölçüm**
(kod okuma, gerçek Postgres'te koşturma, paket içeriği arama). Gerçek kullanıcı
verisi ya da gerçek cihaz ölçümü **yok**.

---

## A. Bulunan kusurlar ve yapılanlar

### A1 — 🔴 Web paketi üç sürüm geride kalmıştı · DÜZELTİLDİ

`docs/app`, `vekilpro.app/app` adresinde servis edilen derlenmiş web
uygulaması. Depoya **elle** işleniyor (`npm run export:web`) ve en son
`1e9377d` commit'inde derlenmiş.

O tarihten sonra kaynağa giren ama **web'e hiç ulaşmamış** olanlar:

| Commit | İçerik |
|---|---|
| `c72b85e` | Zaman/çalışma kaydı (yeni özellik) |
| `d0bd76c` | Serbest meslek makbuzu dökümü (yeni özellik) |
| `377f55f` | Safha rozeti gecikme düzeltmesi |

Yani ürün sahibi "safha rozetleri laglı" diye bildirdiğinde, düzeltme
yazıldıktan sonra bile web'de eski hâli görmeye devam edecekti.

**Kök sebep:** CI (`kontrol.yml`) `docs/app` içindeki dosyaların VARLIĞINI
kontrol ediyordu, GÜNCELLİĞİNİ değil.

**Yapıldı:** paket yeniden derlendi (4,7 MB → 4,9 MB); üç özelliğin de yeni
pakette olduğu dizge araması ile doğrulandı. CI'ya *"Web paketi kaynakla aynı
sürümde mi"* adımı eklendi: `app/`+`src/` içine dokunan son commit,
`docs/app`'e dokunan son committen yeniyse derleme durur ve aradaki commit'leri
listeler.

### A2 — 🔴 İki göç her koşucuda sözdizimi hatası veriyordu · DÜZELTİLDİ

`0068_ictihat_arama_eksik_sonuc.sql` ve `0069_ictihat_uzunluk_normalizasyonu.sql`,
fonksiyon gövdesinin kapanış etiketinden (`$function$`) sonra **noktalı virgül
taşımıyordu**. Postgres ardından gelen `grant` satırını gövdenin devamı sayıp
`syntax error at or near "grant"` veriyor.

Bu iki dosya **hiçbir ortamda hiç çalışmamış** olmalı.

**Neden fark edilmedi:** CI yalnız *değişen* göçleri deniyor; bu dosyalar
yazıldıktan sonra hiç değişmedi.

**Canlıya etkisi yok:** aynı fonksiyonu `0111` ve `0113` sonradan yeniden
tanımlıyor ve ikisi de doğru yazılmış (`$function$;`). Yani canlıdaki arama
fonksiyonu sağlam. Kırık olan, **göç zincirinin sıfırdan tekrar
oynatılabilirliğiydi**.

**Yapıldı:** iki noktalı virgül eklendi. CI'ya *"Migration fonksiyon gövdeleri
kapanıyor mu"* bekçisi eklendi — bekçinin gerçekten ısırdığı, dosyayı kasten
bozup denenerek kanıtlandı.

### A3 — 🟡 `android.permission.NOTIFICATIONS` diye bir izin yok · DÜZELTİLDİ

`app.json` bunu bildiriyordu. Android'de böyle bir izin adı yok; doğrusu
`POST_NOTIFICATIONS`. Expo 57 dokümanı da bu adı hiç anmıyor.

**İşlevsel etkisi yoktu:** `expo-notifications` kendi manifestinde
`POST_NOTIFICATIONS` ve `RECEIVE_BOOT_COMPLETED` bildiriyor (node_modules'te
doğrulandı), manifest birleşmesiyle uygulamaya geçiyor. Yani bildirimler
çalışıyordu. Ama Play Console'un izin listesinde tanınmayan bir satır olarak
görünürdü.

**Yapıldı:** doğru adla değiştirildi. `SCHEDULE_EXACT_ALARM` ise **doğru**
konmuş — Expo 57 dokümanı Android 12+ için bunu açıkça istiyor.

---

## B. Ölçülüp temiz çıkanlar

Bunları "sorun yok" diye geçmiyorum; ne ölçüldüğünü yazıyorum ki tekrar
ölçülebilsin.

| Alan | Ölçüm | Sonuç |
|---|---|---|
| Tip denetimi | `tsc --noEmit` | temiz |
| Testler | `vitest run` | 66 dosya / **742 test** geçiyor |
| RLS kapsamı | `public` şemasındaki her tablo tarandı | **RLS kapalı tablo YOK** |
| `anon` açığı | Politikalarda `anon` rolü arandı | **anon'a açık politika YOK** |
| Politikasız tablolar | 6 tablo (katalog, hasat, denetim kaydı) | Yalnız uç işlevlerden (service_role) okunuyor — doğru |
| Arka plan uçları | `servis_yetki_kontrol()` üç rolle denendi | `authenticated`/`anon` → **permission denied**; yalnız service_role `true` |
| Sır taraması | Tüm depo: `sb_secret_`, `sk-`, `gsk_`, `AIza`, `re_`, JWT | Tek JWT var, çözüldü: **`role: anon`** (tasarımı gereği açık). `.env` izlenmiyor |
| Bağımlılık açıkları | `npm audit` 11 yüksek | 10'u yalnız derleme zinciri. `nanoid` pakete giriyor ama `nanoid()` argümansız çağrılıyor — açığın tetiklendiği yol değil |
| Çeviri bütünlüğü | tr/en anahtar kümeleri | **1775 = 1775**, fark yok |
| Yer tutucu tutarlılığı | Her anahtarda `{{...}}` karşılaştırıldı | **0 uyuşmazlık** |
| İzleme/reklam iddiası | package.json + kod + tanıtım sitesi | **Doğru** — hiçbir izleyici/analitik yok |
| Ölü kod | TODO/FIXME/HACK ve `console.log` | **0 / 0** |
| Web kırılganlığı | `expo-file-system` kullanan 3 dosya | Üçü de `Platform.OS === 'web'` ile korunuyor |
| Bildirim hatası | `scheduleFromRow` | try/catch içinde — web'de bildirim kurulamazsa kayıt yine de başarılı |

---

## C. Karar bekleyen bulgular — kod değişikliği YAPMADIM

### C1 — 🟠 Beş ekran yayına giriyor ama menüde yok (1.641 satır)

Ölçüm: hiçbir `router.push`/menü girdisi bu ekranlara gitmiyor.

| Ekran | Satır | Erişim |
|---|---|---|
| `app/jobs/index.tsx` (tevkil/devir ilan panosu) | 369 | **hiçbir yerden** |
| `app/chat/index.tsx` | 589 | yalnız jobs üzerinden → dolaylı olarak erişilemez |
| `app/chat/[peerId].tsx` | 338 | yalnız jobs üzerinden |
| `app/chat/office.tsx` | 172 | yalnız chat üzerinden |
| `app/daily-question.tsx` | 173 | **hiçbir yerden** |

expo-router'da dosya = rota olduğundan bunlar **derin bağlantıyla hâlâ
açılabilir**. Arka tabloları canlı ve RLS'leri doğru (`dm_messages` yalnız
taraflara, `office_messages` yalnız üyelere, `jobs` her oturum açmış avukata).

**Karar sizin:** (a) menüye bağla, (b) kaldır, (c) olduğu gibi bırak.
Bunlar rakiplerde olmayan özellikler — bitmiş hâlde saklı durmaları yazık.
Ama (a) seçilirse **önce C2 çözülmeli**.

### C2 — 🟠 Gizlilik metinleri ilan panosu/sohbetten hiç bahsetmiyor

Ölçüm: `docs/privacy.html`, `app/kvkk.tsx`, `src/components/KvkkMetin.tsx`,
`docs/guvenlik.html` — dördünde de "ilan", "tevkil", "sohbet", "mesaj",
"pano" kelimeleri **sıfır kez** geçiyor.

Oysa kod `PublicProfile` ile başka avukatlara **ad soyad, büro adı, baro
sicil no, avatar** gösteriyor. KVKK aydınlatma metninin veri kategorilerini ve
alıcılarını sayması gerekiyor; baro sicil no başka kullanıcılara açılan kişisel
veridir.

Ayrıca `docs/privacy.html` şunu yazıyor: *"Programda paylaşma, ekip ya da
ikinci kullanıcı diye bir şey yoktur."* Ekranlar menüde olmadığı sürece bu
pratikte doğru; **menüye bağlanırsa yanlış beyan olur.**

### C3 — 🟠 `PLAY.md` kendi içinde çelişiyor

4.3 bölümü önce *"Kullanıcılar birbirini göremez (uygulamada paylaşım/ekip
özelliği yoktur)"* diyor, hemen altındaki uyarı kutusu *"Tevkil Panosu'na
dikkat: doğru cevap evet olmalı; saklamak yanlış beyandır"* diyor.

Formu dolduran kişi ilk cümleyi okuyup "hayır" derse **yanlış beyan** olur ve
bu, uygulamanın kaldırılma sebebidir. C1'in kararı verildikten sonra bu bölüm
tek bir cevaba indirilmeli.

### C4 — 🟡 Kurulum belgesi eksik veritabanı üretiyor · ✅ DÜZELTİLDİ (14.09)

Ölçüm: `KURULUM.md` yalnız `supabase/migrations/0001_init.sql`'i çalıştırmayı
söylüyor. Diğer 126 göçten ve `KURULUM.sql`'den **hiç bahsetmiyor**
(`grep KURULUM.sql KURULUM.md` → sonuç yok).

Göçler tek başına koşulduğunda kodun sorguladığı **6 tablo oluşmuyor**:
`enforcement_files`, `enforcement_collections` (icra modülünün tamamı),
`client_advances`, `client_expenses`, `ictihat_kararlar`,
`ictihat_harvest_state`.

**14.09 düzeltmesi ve bir öz-eleştiri.** 13.09'da "KURULUM.sql altısını
kapatıyor" diye yazmıştım; eksikti. Ölçtüğümde `0001 + KURULUM.sql` yolunun
**12 tabloyu daha** bıraktığı çıktı — `kvkk_onay` (yasal açık rıza kaydı),
`feedback` (gizlilik metninin gösterdiği başvuru kanalı), AI kota tabloları ve
`time_entries` dahil. Yani göçler "isteğe bağlı" değil.

Gerçek Postgres'te ölçülen dört yol:

| Yol | Eksik tablo |
|---|---|
| Yalnız `0001_init.sql` | **29** |
| `0001` + `KURULUM.sql` | **12** |
| Yalnız göçlerin tamamı | **6** |
| **Göçlerin tamamı → sonra `KURULUM.sql`** | **0** ✅ |

`KURULUM.md` bu sıraya göre yeniden yazıldı. Ayrıca `tests/semaKapsami.test.ts`
eklendi: kodun `.from('x')` ile sorguladığı her tablonun göçlerde ya da
`KURULUM.sql`'de bir `create table` ifadesi olmalı. Bekçinin ısırdığı, olmayan
bir tabloyu sorgulayan sahte dosyayla kanıtlandı.

---

### C5 — 🟠 `0091`'in indeksleri hiç kurulmamış olabilir · ✅ ONARILDI (14.09)

Ölçüm: 53 yabancı anahtardan 4'ü indekssiz — `client_advances.owner_id`,
`client_expenses.owner_id`, `enforcement_collections.owner_id`,
`admin_islem_log.yapan`.

İlk üçü önemli: bu tabloların RLS politikaları `owner_id = auth.uid()` ile
süzüyor, yani indekssizken **her okuma tam tarama**. Tek kullanıcıda fark
edilmez, satır sayısı arttıkça sessizce ağırlaşır.

Sebep bulundu: `0091_eksik_indeksler.sql` **tam olarak bu üç indeksi** kurmayı
amaçlamış ama 26. satırda `relation "public.client_advances" does not exist`
ile düşüyor — çünkü o tablolar göçlerde değil `KURULUM.sql`'de. Sonuç
çalıştırma biçimine göre değişiyor ve ikisi de kötü: psql'de 26. satırdan
sonraki **9 indeks de kurulmuyor**; Supabase SQL Editor betiği tek işlemde
koşturduğu için **hiçbiri** kurulmamış olabilir.

**Canlıdaki durumu ölçemedim** (service_role erişimim yok ve istemiyorum).
Bu yüzden `0132_eksik_indeksler_onarim.sql` yazıldı: 0091'in tamamını
`to_regclass` ile tablo/sütun varlığına bakarak yeniden kuruyor, var olanı
atlıyor, olmayan tabloda patlamıyor. Hangi durumda olursa olsun doğru sonuca
yakınsıyor. Boş bir veritabanında hatasız geçtiği ve tam kurulumda "indekssiz
yabancı anahtar: 0 satır" verdiği ölçüldü.

## D. ÖLÇMEDİKLERİM — en önemli başlık

Bunları "sorun yok" diye okumayın; **bakılmadı** demek.

- **Uygulama gerçek bir Android/iOS cihazda hiç çalıştırılmadı.** Bu oturumda
  da çalıştırılmadı. Açılış, bildirimler, takvim izni, biyometrik kilit, Play
  Billing satın alma akışı ve yerli dosya seçici **hiç denenmedi**.
- **Yeni web paketi tarayıcıda açılmadı.** İçinde doğru dizgelerin bulunduğu
  ölçüldü; ekranın gerçekten çizildiği ölçülmedi.
- **`0131_zaman_kaydi.sql` canlıya uygulanmadı.** Zaman kaydı sekmesi canlıda
  boş görünür (hata vermez).
- **Safha gecikmesinin gerçekten kalktığı görülmedi.** Yalnız yama
  fonksiyonunun davranışı test edildi (7 test).
- **Göç oynatması taviz içeriyor:** pgvector ve pg_cron yerelde yok; `vector(N)`
  sütunları `text`e çevrildi, cron taklit edildi. Vektör ve zamanlama davranışı
  ölçülmedi, yalnız sözdizimi ve sıra ölçüldü.
- **Yük/başarım ölçülmedi.** 900 bin satırlık içtihat havuzunda arama
  başarımı bilinmiyor (`0123`'te de yazıyor: FTS ayarları ~11 bin satırda
  yapıldı).
- **Testleri ben yazdım.** 742 testin tamamı bu depodan; bağımsız bir
  doğrulama (avukat/gerçek kullanıcı) yok.
- **Rakip karşılaştırmaları** inceleme sitelerinden okundu, ürünler denenmedi.

---

## E. Yayın öncesi sıra — benim önerim

1. **C4'ü düzelt** (kurulum belgesi) — 10 dakikalık iş, felaket kurtarmayı
   kurtarır.
2. **C1'e karar ver.** Menüye bağlanacaksa önce C2 (KVKK metinleri) ve C3
   (PLAY.md çelişkisi) çözülmeli; bağlanmayacaksa ekranlar kaldırılmalı ki
   derin bağlantıyla açılamasınlar.
3. **`0131` göçünü canlıya uygula.**
4. **Yeni AAB üret** — mevcut AAB (`bc8f206`) zaman kaydını, makbuzu ve
   gecikme düzeltmesini **içermiyor**.
5. **Gerçek telefonda aç.** Bu, listedeki en önemli madde ve bugüne kadar hiç
   yapılmadı. Yukarıdaki 742 testin hiçbiri bunun yerine geçmez.
