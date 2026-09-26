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

---

# ⚠ 18.09.2026 — BU TASLAK EKSİKTİ, VERİTABANI DÜZELTTİ

Yukarıdaki tablo `docs/privacy.html`'den türetilmişti. Ürün sahibi Apple'ın
ekranındayken **canlı şema ölçüldü** ve tabloda olmayan üç veri türü çıktı:

```
clients.address              → app/client-form.tsx:136'da ADRES GİRDİSİ VAR
profiles.tc_no · clients.tc_no → app/client-form.tsx:83'te TC GİRDİSİ VAR
purchases (product, amount, currency, expires_at)  → satın alma geçmişi
ayrıca: enforcement_files.debtor_address · finance_entries (gelir-gider)
```

**Yani `docs/privacy.html` de eksik.** "Hangi Veriler İşlenir?" bölümü
ad/e-posta/telefon/büro/baro sayıyor; **TC kimlik numarasını ve adresi
saymıyor.** Bu Apple'dan AYRI bir sorun: KVKK aydınlatma metni işlenen veri
kategorilerini eksiksiz saymak zorunda. Ürün sahibine bildirildi.

## DOĞRU TİK LİSTESİ (ölçümden sonra)

| Apple bölümü | tik | kaynak |
|---|---|---|
| Contact Info → Name | ✅ | `profiles.full_name`, `clients.full_name` |
| Contact Info → Email Address | ✅ | `profiles.email`, `clients.email` |
| Contact Info → Phone Number | ✅ | `profiles.phone`, `clients.phone` |
| Contact Info → **Physical Address** | ✅ | `clients.address` — **taslakta YOKTU** |
| Contact Info → Other User Contact Info | ✅ | `clients.company`, `title` |
| Financial Info → **Other Financial Info** | ✅ | `finance_entries` (vekâlet ücreti, tahsilat, gider), `enforcement_files` borç tutarları — **taslakta YOKTU** |
| Financial Info → Payment Info / Credit Info | ❌ | kart bilgisi bize hiç gelmiyor, tahsilatı Apple yapıyor |
| **Purchases → Purchase History** | ✅ | `purchases` tablosu — **taslakta YOKTU** |
| User Content → Other User Content | ✅ | dava, duruşma, görev, not kayıtları |
| User Content → **Photos or Videos** | ✅ | dosyaya belge/fotoğraf ekleme (`docs/privacy.html` "Fotoğraf/Kamera") |
| Identifiers → User ID | ✅ | `auth.uid()`, her tabloda `owner_id` |
| Identifiers → Device ID | ❌ | cihaz kimliği toplanmıyor |
| Diagnostics → Crash Data | ✅ | `istemci_hata` (göç 0143) |
| **Other Data → Other Data Types** | ✅ | **TC kimlik no** (`tc_no`), baro sicil, büro adı — **taslakta YOKTU** |
| Health & Fitness | ❌ | `AGENTS.md` kalıcı kuralı |
| Location | ❌ | konum izni hiç istenmiyor |
| Contacts | ❌ | telefon rehberi okunmuyor |
| Browsing / Search History | ❌ | uygulama içi tarayıcı yok |
| Usage Data | ❌ | analitik SDK'sı yok |
| Sensitive Info | ❌ | Apple'ın tanımı ırk/din/cinsel yönelim/biyometri; TC no bu listede DEĞİL, "Other Data" altında beyan edildi |

Üç sorunun cevabı tüm türlerde aynı:
**amaç = App Functionality · kimliğe bağlı = Yes · TRACKING = NO**

## DERS

Beyanı **gizlilik metninden** türettim; oysa gizlilik metni de bir iddiadır,
ölçüm değil. Doğru kaynak **şemanın kendisi**. İkisi ayrışmıştı ve ayrışmayı
ancak ürün sahibi ekrandaki kutuları okuyup "bunlar yok" deyince fark ettim.
