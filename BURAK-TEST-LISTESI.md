# Burak'a test listesi — 14.09.2026

Bu liste "bak bakalım" demek yerine **ne deneneceğini** söylüyor. Sebebi şu:
serbest kullanım, en çok kullanılan yolu bir kez daha doğrular; hiç
ölçülmemiş yerleri değil. Aşağıdaki her madde, `YAYIN-DENETIMI.md`'de
**"ÖLÇÜLMEDİ"** diye işaretlenmiş bir şeye nişan alıyor.

**Kurulum:** Bağlantıyı **Android telefonda** aç, sayfadaki düğme kurar.
Android "bilinmeyen kaynaklardan yükleme" izni isteyecek (Ayarlar →
Uygulamalar → tarayıcıya izin).

https://expo.dev/accounts/olivyeejiru/projects/macro_ko/builds/7be3b109-a75d-458a-899c-0c3de6895f6e

**Bir hata bildirince yeniden kurmana gerek YOK.** Uygulama kendini havadan
güncelliyor (OTA): düzeltmeyi yayınladığımızda, uygulamayı **tamamen
kapatıp** (son kullanılanlardan kaydır, sadece geri tuşu yetmez) yeniden
açman yeterli — dakikalar içinde inerler. Yalnız izin/kütüphane gibi
**yerel** değişiklikler yeni kurulum gerektirir; öyle bir şey olursa
söyleriz. Bu yüzden "şu hata düzeldi mi" diye sorduğumuzda, önce kapat-aç.

**Hata bulunca ne yazılacak:** ne yaptın, ne bekledin, ne oldu. Ekran
görüntüsü varsa en iyisi. "Çalışmıyor" tek başına düzeltilemez.

---

## A. Hiç denenmemiş olanlar — ÖNCELİK BURASI

Bunların hiçbiri bugüne kadar gerçek bir cihazda çalıştırılmadı.

- [ ] **Uygulama açılıyor mu.** İlk açılış, giriş, panonun yüklenmesi.
- [ ] **Bildirim izni.** Uygulama izin istiyor mu, verince duruşma
      hatırlatması geliyor mu? Bir duruşmayı **5 dakika sonraya** kurup
      telefonu kilitle ve bekle.
- [ ] **Takvime ekleme.** Duruşmayı telefon takvimine ekle — izin ekranı
      çıkıyor mu, kayıt gerçekten takvimde görünüyor mu?
- [ ] **Biyometrik kilit.** Ayarlar'dan aç, uygulamayı kapat-aç. Parmak izi
      soruyor mu? **Sormuyorsa bu ciddi:** açık sanıp korumasız kalırsın.
- [ ] **Belge yükleme.** Dosyaya PDF ekle (hem galeriden hem dosya seçiciden).
      Yükleniyor mu, sonra açılıyor mu?
- [ ] **Kamera ile evrak çekme.** Fotoğraf çekip dosyaya ekle.
- [ ] **Çevrimdışı.** Uçak moduna al, uygulamayı gez. Çöküyor mu, yoksa
      "bağlantı yok" mu diyor?

## B. Bu hafta eklenen yeni şeyler — hiç kimse kullanmadı

- [ ] **Çalışma kayıtları.** Bir dosya aç → **Çalışma Kayıtları** sekmesi.
      - Sayacı başlat, uygulamadan çık, 2 dakika bekle, geri gel. **Sayaç
        doğru mu sayıyor?** (Arka planda durmaması gerekiyor.)
      - "Durdur ve kaydet" → süre forma doğru geliyor mu?
      - Süre kutusuna **"1,5"** yaz. Altında **"1 sa 30 dk"** yazmalı.
        **"1 dk" yazıyorsa hata.**
      - "90" yaz → 90 dk demeli. "1:30" yaz → 1 sa 30 dk demeli.
      - Saatlik ücret gir, tutar doğru hesaplanıyor mu?
- [ ] **Makbuz dökümü.** Finans → bir **gelir** kalemine dokun → "Makbuz
      dökümü".
      - KDV ve stopaj doğru mu?
      - **"Yazıyla" satırı doğru mu?** (Örn. 10.000 → "ONBİN TL")
      - Belgenin altında "bu resmî makbuz değildir" uyarısı duruyor mu?
- [ ] **Safha rozetleri.** İcra dosyasında safhaya dokun — **gecikme var mı?**
      (Bu hafta düzeltildi, gerçek cihazda doğrulanmadı.)
- [ ] ⭐ **Toplu aktarım — LİSTENİN EN DEĞERLİ MADDESİ.** Menü → **Toplu
      Aktarım**. (Bu ekran ilk APK'da yoktu, havadan indi; göremiyorsan
      uygulamayı tamamen kapatıp aç.)

      **Neden en değerlisi:** ayrıştırıcıyı yazdım ve 27 testten geçiyor,
      **ama testlerdeki örnek dosyaları ben uydurdum.** Gerçek bir UYAP ya
      da büro programı çıktısıyla hiç denenmedi. Senin bir dosyan, benim
      yazdığım yirmi testten daha çok şey söyler.

      - UYAP Avukat Portal'dan ya da kullandığın programdan dosya listesini
        **Excel/CSV olarak dışa aktar** ve olduğu gibi yükle — düzeltme,
        sütun silme, başlık değiştirme yapma. Bozuk hâliyle görmemiz lazım.
      - Sütunları doğru tanıdı mı? (Esas No, Mahkeme, Müvekkil, Karşı
        Taraf, Açılış Tarihi)
      - **Kuru çalıştırmada** kaç satır okundu, kaç satır atlandı ve
        atlananların **sebebi** yazıyor mu?
      - Tarihler doğru mu? (`04.02.2026` → 4 Şubat 2026)
      - Türkçe harfler bozuldu mu? (Ş, İ, Ğ, Ü, Ö, Ç)
      - **Dosya işe yaramazsa bile at bize** — hangi biçimde takıldığı
        bilgisi, çalışan bir aktarımdan daha kıymetli.

## C. Senin bildiğin, bizim bilmediğimiz — en değerli kısım

Burada aradığımız hata değil, **yanlışlık**. Program hukuken yanlış bir şey
söylüyorsa onu ancak sen görürsün.

- [ ] **Süre hesaplayıcıları.** Bildiğin bir dosyanın süresini hesapla ve
      kendi hesabınla karşılaştır. Adli tatil ve resmî tatil doğru mu
      uygulanıyor?
- [ ] **Kapak hesabı.** İcra dosyasında bildiğin bir kapak hesabını gir.
      İİK 138 sırası (masraf → faiz → asıl alacak) doğru işliyor mu?
- [ ] **AAÜT vekalet ücreti.** Hesaplayıcıdaki dilimler doğru mu?
      ⚠️ Bu dilimlerin hangi yıla ait olduğunu **bilmiyoruz** ve ekranda
      "doğrulanmadı" yazıyor. Senin teyidin bu uyarıyı kaldırabilir.
- [ ] **Duruşma türleri ve mazeret kuralı.** Daha önce senin söylediğin gibi
      mi çalışıyor?
- [ ] **Dilekçe üretimi.** Bir dilekçe ürettir ve **hukuken** oku: kullanılabilir
      mi, yoksa düzeltmek yazmaktan uzun mu sürer?

## D. Atıf denetimi — bizim en iddialı özelliğimiz

Bu, rakiplerin yapmadığı şey ve **senin sınavın en önemlisi.**

- [ ] Yapay zekâya birkaç dilekçe/mütalaa ürettir.
- [ ] Çıktının altındaki **atıf denetimi** kutusuna bak:
      - "BU ATIFLAR OLAMAZ" dediği künyeler **gerçekten olanaksız mı?**
      - "Doğrulandı" dediklerini UYAP'tan teyit et — **gerçekten var mı?**
      - **Yakalayamadığı uydurma künye var mı?** (En kritik soru bu.
        Yanlış "doğrulandı" demesi, hiç denetlememekten kötüdür.)

## E. Senden iki dosya — UYAP entegrasyonu bunlara bağlı

Ürün sahibinde e-imza yok, bu ikisini yalnız sen alabilirsin.

- [ ] **UYAP Avukat Portal → Duruşmalarım → "Excel'e Aktar"** çıktısı.
      Sütun yapısı lazım; müvekkil adlarını karalayabilirsin.
- [ ] **Dosya listesi sayfasının ekran görüntüsü.** Sütun başlıkları
      görünsün yeter, içerik önemli değil.

Bu ikisi gelince sütun eşlemeli içe aktarım gerçek veriyle denenebilir ve
eklentinin "tek tıkla dosyalarım" kısmı yazılabilir.

---

## Neye "hata" demeli

Hata: çöküyor, kaydetmiyor, yanlış hesaplıyor, yanlış gösteriyor.
Hata değil: "şu daha güzel olurdu" — o da değerli ama ayrı yaz, karışmasın.

**Hukuken yanlış olan her şey en yüksek öncelik.** Bir hukuk programında
yanlış süre, yanlış faiz ya da uydurma künye, çökmekten daha kötüdür:
çökme görünür, yanlış sayı görünmez.
