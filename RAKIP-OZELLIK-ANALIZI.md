# Dünyadaki benzer uygulamalar — neyi eksik bırakıyoruz

Tarih: 13.09.2026. Soru: *"dünyadaki benzer uygulamalara bakıp neler
ekleyebiliriz."*

## Kanıtın kaynağı — önce bunu okuyun

Bu belgede iki ayrı güvenilirlikte bilgi var ve **karıştırılmadı**:

| İşaret | Ne demek |
|---|---|
| **ÖLÇÜLDÜ** | Bu depoda kodun/şemanın kendisine bakılarak saptandı. Tekrar bakılsa aynı çıkar. |
| **KAYNAK: inceleme sitesi** | Rakip ürünlerin özellikleri, Eylül 2026'da üçüncü taraf karşılaştırma yazılarından okundu. Ürünleri **kullanmadım**, satıcı beyanını doğrulamadım. Yanlış olabilir. |

Hiçbir yere puan vermiyorum. "Şu kadar iyileşir" demiyorum — ölçülmemiş şeye
sayı vermek bu projede yasak.

---

## A. Bizde ne var — ÖLÇÜLDÜ

Rakip listesine bakmadan önce kendi yüzeyimizi saydım, çünkü "eksik" diye
yazacağım şeyin gerçekten eksik olduğundan emin olmam gerekiyordu.

**Var (kodda görüldü):**

- Dava, müvekkil, duruşma, süre, görev, belge, finans yönetimi
- İcra takibi + tahsilat + **kapak hesabı** (`src/utils/kapak.ts`, İİK 138
  sırasına göre basit faiz, gün bazında)
- Çıkar çatışması taraması (`src/utils/menfaatCatismasi.ts` +
  `MenfaatUyarisi`, güçlü/zayıf eşleşme ayrımıyla)
- AAÜT vekalet ücreti hesabı (`src/config/tarife.ts`, dilimleri
  "doğrulanmadı" diye işaretli)
- Serbest meslek makbuzu **hesabı** (KDV/stopaj/net), `finance-form` içinde
- Müvekkil avans + masraf defteri (`client_advances`, `client_expenses`) —
  emanet parasının Türkiye'deki karşılığı
- Taksit + ödeme sözü takibi (`case_installments`, `payment_promises`)
- İçtihat ve mevzuat arama, **atıf denetimi** (`ictihat_atif`,
  `atif_denetim_kaydi`, `denetim.js`)
- Dilekçe üretimi, mütalaa, belge incelemesi, UDF (.udf) çıktısı
- Süre sihirbazı, duruşma çakışma kontrolü, bildirimler, takvime ekleme
- CSV dışa aktarım (`src/utils/exportCsv.ts`)
- Raporlar ekranı (dava durumu, aylık duruşma, süre, finans)
- Büro sohbeti + tevkil/devir iş ilanı panosu

**Yok (arandı, bulunamadı):**

| Eksik | Nasıl ölçüldü |
|---|---|
| **Zaman/çalışma kaydı** | `duration_minutes`, `billable`, saatlik ücret — şemada ve tiplerde **hiçbiri yok** |
| **Fatura/makbuz belgesi** | SMM yalnız hesap; `serbestMeslekMakbuzu` yalnız `finance-form.tsx`'te kullanılıyor, hiçbir yerde belge/PDF üretmiyor |
| **Müvekkil portalı** | Hiç yok; her satır `owner_id = auth.uid()` ile kilitli |
| **Ekip dosya paylaşımı** | `useOffice.ts` yalnız `offices`, `office_members`, `office_messages`'e dokunuyor — **büro bir sohbet odası, dosya paylaşımı değil** |
| **İçe aktarım** | Dışa aktarım var, içe aktarım yolu yok |
| **Şablon otomatik doldurma** | `petitionTemplates.ts` köşeli parantezli metin; dosya/müvekkil verisinden **elle** doldurulur |
| **UYAP Avukat Portal bağlantısı** | Yok |

---

## B. Rakipler ne yapıyor — KAYNAK: inceleme siteleri, Eylül 2026

### Uluslararası (Clio, MyCase, PracticePanther, Smokeball)

Dördünde de ortak çekirdek: **dava yönetimi, zaman ve masraf kaydı,
faturalama, belge saklama, müvekkil portalı.** Fiyatlar kullanıcı/ay:
MyCase ~39-89 $, PracticePanther ~49 $, Clio 49-149 $, Smokeball teklif usulü.

Ayrıştıkları yer:

- **Clio** — IOLTA emanet hesabı (müvekkil ve dosya bazında ayrı defter,
  üçlü mutabakat, aşım engelleme), Plaid ile banka bağlantısı, mahkeme
  kurallarına dayalı takvim
- **Smokeball** — **otomatik** zaman kaydı (avukat başlat/durdur demeden
  ölçüyor) ve Microsoft Word içinden çalışma
- **MyCase / PracticePanther** — ödeme alma + yapay zekâ (MyCase IQ)

### Yapay zekâ ürünleri (Harvey, CoCounsel, Spellbook)

- **CoCounsel** — Westlaw/Practical Law üstünde; yanıtlar **doğrulanmış
  veritabanına karşı atıf denetimli**
- **Harvey** — çok belgeli ortak çalışma alanı (Vault), atıflar firmanın
  kendi yüklediği belgelerden
- **Spellbook** — tamamen sözleşme odaklı, Word içinde

### Türkiye (Sinerji, KolayOfis, Tebli, Avukat Bulut, Lawyer Team)

Buradaki satış argümanı bizimkinden farklı ve tek bir şeyin etrafında dönüyor:

- **UYAP entegrasyonu** — dosya verisini doğrudan çekmek, **toplu icra
  takibini tek tıkla adliyeye göndermek**
- **e-Tebligat / UETS yönetimi** (Tebli'nin ana işi)
- Toplu SMS / e-posta ile müvekkil bilgilendirme
- Büyük Yargıtay/Danıştay/AYM karar veritabanı (Sinerji)

---

## C. Gerçek boşluklar — sırayla

Sıralama "rakipte var + bizde yok + bizim mimarimizde yapılabilir" üçlüsüne
göre. Her madde için **ne olduğu** ve **neyi gerektirdiği** yazıldı; "kolay"
demiyorum, çünkü hiçbirini kodlamadan süre tahmini vermek bu projede yasak.

### 1. Zaman/çalışma kaydı — en büyük ve en yapılabilir boşluk

Dört uluslararası üründe de merkezde; bizde **hiç yok** (ÖLÇÜLDÜ).

Türkiye itirazı meşru: avukatların çoğu saat başı çalışmıyor, nispi vekalet
ücreti alıyor. Ama kayıt yalnız fatura için değil:

- hangi dosya zamanı yiyor (nispi ücretli dosyada da bilmek istersiniz)
- kurumsal/danışmanlık işinde saatlik ücret **zaten** var
- tevkil verirken "bu iş ne kadar sürdü" sorusunun cevabı olur

Gerektirdiği: bir tablo (`time_entries`: dosya, açıklama, dakika, tarih,
ücretlendirilir mi, saatlik ücret), bir form, dosya ekranında toplam, raporda
bir bölüm. Var olan RLS ve finans deseninin içine oturur — yeni mimari
gerekmez.

### 2. Serbest meslek makbuzunun kendisi

Hesabı **var**, belgesi **yok** (ÖLÇÜLDÜ). Avukat KDV'yi ve stopajı ekranda
görüyor ama müvekkile verecek makbuzu başka yerde yazıyor.

Gerektirdiği: elimizdeki `hesaplaSmm` çıktısını PDF/yazdırılabilir bir
belgeye dökmek. Zaten UDF ve PDF çıktı altyapısı var (`src/lib/cikti.ts`).
Bu, listedeki en küçük iş ve en somut günlük faydası olan.

### 3. Müvekkil portalı / paylaşım bağlantısı

Dört uluslararası üründe de var; bizde yok. Müvekkil "dosyam ne oldu" diye
aradığında avukat her seferinde elle anlatıyor.

**Dikkat:** bu, verinin sahibinin RLS sınırından **dışarı çıktığı ilk
özellik** olur. Bugün her satır tek sahibine kilitli ve gizlilik metnimiz de
bunu böyle yazıyor. Yapılacaksa en dar biçimiyle yapılmalı: dosya bazında,
süreli, iptal edilebilir, **salt okunur** bir bağlantı; belge indirme ayrı
karar. Yanlış kurgulanırsa meslek sırrı sorunu olur — bu yüzden 1. ve 2.
maddeden sonraya koydum, teknik zorluk yüzünden değil.

Ara adım olarak elimizde zaten `src/utils/clientUpdate.ts` var (müvekkile
gönderilecek durum metni üretiyor). Portal yerine "aylık otomatik durum
mesajı" bunun üstüne kurulabilir.

### 4. Başka programdan içe aktarım

Rakip listesinde ayrı bir özellik olarak geçmiyor ama **geçiş engelinin
kendisi bu**: Sinerji/KolayOfis kullanan bir avukat, 300 dosyasını elle
girmeyi göze almadan bize geçmez. Dışa aktarımımız var, içe aktarımımız yok
(ÖLÇÜLDÜ).

Gerektirdiği: CSV/Excel'den dava + müvekkil aktarımı, sütun eşleme ekranı,
kuru çalıştırma (önce göster, sonra yaz). Rakiplerin dışa aktarma biçimlerini
**görmedim** — o biçimleri bilmeden eşleme ekranı tasarlanamaz, dolayısıyla
bu maddenin ilk adımı kod değil, bir avukattan örnek dosya almak.

### 5. Ekip/büro — dosya paylaşımı

Bugün büro yalnız bir sohbet odası (ÖLÇÜLDÜ). Rakiplerde çok kullanıcı
çekirdek özellik ve fiyatlandırma da kullanıcı başına.

Bu, listedeki **en büyük mimari iş**: RLS'in tamamı `owner_id = auth.uid()`
üstüne kurulu; büro paylaşımı her tablonun politikasını değiştirmek demek.
Yanlış yapılırsa sonucu "başka avukat müvekkil dosyanı gördü" olur. Küçük bir
özellik gibi görünüp en pahalıya patlayacak madde budur.

### 6. UYAP Avukat Portal entegrasyonu — bugün yapılamaz, sebebini yazıyorum

Türk rakiplerin **birinci** satış argümanı. Bizde yok ve **yakında da
olmayacak**; bunu saklamak yerine açıkça yazmak lazım:

- Avukat Portal'a giriş **e-imza / m-imza** ile yapılıyor
- Üçüncü parti yazılımlar UYAP'ın **web servis** altyapısı üzerinden
  bağlanıyor ve bu **sertifikasyon** gerektiriyor (kaynak: entegrasyon yapan
  yazılımların ve bir hukuk bürosunun anlatımı; Adalet Bakanlığı'nın resmî
  başvuru koşullarını **okumadım**)
- Expo ile derlenmiş bir mobil/web uygulamasından akıllı kart okuyucuya
  erişmek mümkün değil; masaüstü bir köprü gerekir

Yani bu, "bir sprint'te eklenecek özellik" değil, **ayrı bir ürün kararı**.
Not: `UYAP-NOTU.md`'deki Bedesten *emsal karar* ucu bambaşka bir şeydir —
herkese açıktır, anahtar istemez ve onu zaten kullanıyoruz. İkisi
karıştırılmasın.

### 7. e-Tebligat / UETS

Tebli'nin tüm işi. Aynı engel (kimlik doğrulama + entegrasyon izni).
Ölçmedim, araştırmadım — **bilmiyorum** diyorum.

---

## D. Zaten önde olduğumuz yer — bunu kaybetmeyelim

Rakip taramasının beklemediğim çıktısı bu oldu:

- **Atıf denetimi.** CoCounsel'in ana satış argümanı "uydurma atıf yok".
  Bizde `ictihat_atif` + `atif_denetim_kaydi` + `denetim.js` ile bu **zaten
  var** ve içtihat kataloğu buna hizmet ediyor. Uluslararası ürünlerin
  hiçbiri Türk içtihadında bunu yapmıyor.
- **Kapak hesabı.** İİK 138 sırasına göre, tahsilat tarihlerine duyarlı faiz.
  Clio'nun emanet defteri bunun yerine geçmez; bu Türkiye'ye özgü ve
  uluslararası hiçbir üründe yok.
- **AAÜT + serbest meslek makbuzu mantığı.** Aynı şekilde yerel.

Yani boşluk listesi uzun ama tek yönlü değil.

---

## E. Tavsiye

Sırayla **1 (zaman kaydı)**, **2 (makbuz belgesi)**, **4 (içe aktarım)**.

Sebebi: üçü de var olan mimarinin içine oturuyor, hiçbiri RLS sınırını
değiştirmiyor, üçü de rakip karşılaştırma tablolarında bizim boş kalan
kutularımız. 3 ve 5 gizlilik/mimari kararı gerektirdiği için ürün sahibinin
kararı olmalı, 6 ve 7 bugün yapılabilir değil.

**Bu belgede ölçülmemiş tek bir iddia var ve işaretliyorum:** rakip
özelliklerinin tamamı inceleme sitelerinden okundu, ürünler denenmedi.
Özellik listeleri pazarlama metninden kopyalanmış olabilir.
