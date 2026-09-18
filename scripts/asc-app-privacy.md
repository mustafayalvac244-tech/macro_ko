# App Privacy (veri etiketi) — cevaplar ve KODDAKİ kaynakları

> **18.09.2026.** Ürün sahibi: *"sen yap her şeyi bitir."* Bu dosya Apple'ın
> "App Privacy" beyanının cevaplarıdır. Her satırın yanında **koddaki
> kaynağı** yazıyor — hiçbiri tahmin değil, hepsi dosyadan okundu.
>
> **`docs/privacy.html` ile tutarlı olmalı.** Apple'ın etiketi ile gizlilik
> metninin çelişmesi, yayından sonra da ceza sebebidir.

## Apple'a verilecek cevaplar

Üç sütun her kategori için ayrı sorulur:
**Toplanıyor mu · Kimliğe bağlı mı · İZLEME (tracking) için mi**

| Apple kategorisi | toplanıyor | kimliğe bağlı | izleme | amaç | KODDAKİ KAYNAK |
|---|---|---|---|---|---|
| **Contact Info → Name** | evet | evet | **hayır** | Uygulama İşlevi | `profiles.full_name` (kayıt ekranı) |
| **Contact Info → Email Address** | evet | evet | **hayır** | Uygulama İşlevi · Hesap Yönetimi | `profiles.email`, Supabase Auth |
| **Contact Info → Phone Number** | evet | evet | **hayır** | Uygulama İşlevi | `profiles.phone` — **isteğe bağlı**, boş bırakılabilir |
| **Contact Info → Other** | evet | evet | **hayır** | Uygulama İşlevi | `profiles.firm_name`, `profiles.bar_number` (baro sicil, isteğe bağlı) |
| **User Content → Other User Content** | evet | evet | **hayır** | Uygulama İşlevi | dava, müvekkil, duruşma, görev, belge, finans kayıtları — kullanıcının kendi girdiği veri |
| **Identifiers → User ID** | evet | evet | **hayır** | Uygulama İşlevi | `auth.uid()` — her tabloda `owner_id`, RLS bunun üstünde çalışıyor |
| **Diagnostics → Crash Data** | evet | **kısmen** | **hayır** | Uygulama İşlevi (teşhis) | `src/lib/hataKaydi.ts` → `istemci_hata` tablosu |

## Toplanmayanlar — tek tek ölçüldü

| Apple kategorisi | neden hayır |
|---|---|
| Location | uygulama konum izni hiç istemiyor (`docs/privacy.html`: "konumunuza … erişmez") |
| Contacts | rehber erişimi yok |
| Health & Fitness | **sağlık verisi bu depoya girmiyor** — `AGENTS.md` kalıcı kuralı |
| Financial Info (ödeme) | kart bilgisi bize hiç gelmiyor; tahsilatı Apple/Google yapıyor. `finance_entries` kullanıcının KENDİ büro gelir-gideri, ödeme aracı değil — bu yüzden "User Content" altında beyan edildi |
| Browsing History | uygulama içi tarayıcı yok; bağlantılar `Linking.openURL` ile sistem tarayıcısına gidiyor |
| Search History | arama sorguları kullanıcıya bağlı saklanmıyor |
| Advertising Data | **reklam yok** — `usesIdfa=false` olarak da beyan edildi |
| Sensitive Info | ırk, din, cinsel yönelim, biyometri toplanmıyor. Face ID **cihazda** çalışır, veri bize gelmez |

## "İzleme (tracking) yapıyor musunuz?" → **HAYIR**

Apple'ın tanımı: veriyi **başka şirketlerin** uygulama/siteleriyle eşleştirip
hedefli reklam ya da veri simsarlığı için kullanmak.

- uygulamada reklam ağı yok
- analitik SDK'sı yok
- IDFA istenmiyor (`usesIdfa=false`)
- veri satılmıyor (`docs/privacy.html`: *"hiçbir üçüncü tarafa satılmaz"*)

Bu yüzden **App Tracking Transparency izni de istenmiyor** ve istenmemeli.

## AÇIKÇA SÖYLENMESİ GEREKEN — yapay zekâ aktarımı

`docs/privacy.html` şunu yazıyor: yapay zekâ özelliklerini kullanınca
**o istekte kullanıcının kendi yazdığı metin**, yanıt üretilebilmesi için
ABD'deki sağlayıcıya gider.

Apple'ın etiketinde bunun **ayrı bir kutusu yok** — üçüncü tarafa aktarım
kategori bazında değil, "toplanan veri" üzerinden beyan ediliyor ve bu metin
zaten **User Content** altında. Yani etiket eksik değil.

Ama ürün sahibinin bilmesi gereken: bu aktarım **açık rızaya** bağlı,
rıza isteğe bağlı ve sonradan geri alınabilir (`src/config/kvkk.ts`,
`RIZA_ZORUNLU=false`). Rıza verilmezse yapay zekâ kapalı kalır, diğer her
şey çalışır.

## BU DOSYA BEYANI KENDİLİĞİNDEN YAZMAZ

Apple'ın App Privacy beyanının ASC API'sinden yazılabilir olup olmadığı
`alanlar-yaz` modunda **ölçülüyor** (`appDataUsages` uçları boş POST ile
sınanıyor). Açıksa yazılacak; kapalıysa ürün sahibi bu tabloyu App Store
Connect → App Privacy ekranına geçirecek — tablo zaten Apple'ın sorduğu
sırayla dizildi.
