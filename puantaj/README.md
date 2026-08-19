# Puantaj Cetveli

Personel puantajını Excel'e göre çok daha hızlı ve hatasız tutmak için
hazırlanmış, **kurulum gerektirmeyen** bir masaüstü aracı.

Bu klasörde iki şey var:

| Dosya | Ne işe yarar |
|---|---|
| `index.html` | Puantaj uygulaması. Çift tıklayıp tarayıcıda açarsınız. |
| `tools/duzelt.py` | Elinizdeki eski Excel dosyasındaki formül ve kod hatalarını onarır. |

---

## 1. Uygulama — `index.html`

### Kurulum

Yok. `index.html` dosyasını masaüstünüze kopyalayın, çift tıklayın.
Chrome veya Edge ile açılır. İnternet bağlantısı gerekmez.

> Kolay erişim için: dosyaya sağ tık → **Gönder** → **Masaüstü (kısayol oluştur)**

### İlk kullanım

1. **Excel'den Aktar** düğmesine basıp mevcut `PUANTAJ CETVELİ.xlsx`
   dosyanızı seçin. Bütün geçmiş (personel + aylar) tek seferde aktarılır.
   Dosyayı pencereye sürükleyip bırakmak da olur.
2. Aktarma özetini kontrol edip **İçe Aktar**'a basın.
3. Hepsi bu. Bundan sonra her ay doğrudan uygulamada işlenir.

Excel'iniz yoksa **Personel** düğmesinden kişileri elle ekleyerek de
başlayabilirsiniz.

### Günlük kullanım

**Kalem seçip boyayın.** Üstteki şeritten bir kod seçin (ör. *İzinli*),
sonra hücrelerin üzerinde fareyi basılı tutup sürükleyin. Bir kişinin
5 günlük iznini tek hareketle işaretlersiniz.

**Klavyeyle daha da hızlı:**

| Tuş | İşlem |
|---|---|
| `Ç` `İ` `R` `Y` `D` `Ü` | O kodu yazar ve bir sağa geçer |
| `←` `→` `↑` `↓` | Hücreler arasında gezinir |
| `Del` | Hücreyi temizler |
| `Ctrl` + `Z` | Son işlemi geri alır |
| `Alt` + `←` / `→` | Önceki / sonraki ay |

**Toplu işlemler:**

- **Boşları Doldur** — ayın işlenmemiş tüm günlerini seçili kodla doldurur.
  Ayın başında bir kez basın, sonra sadece izin/rapor günlerini işaretleyin.
- **Hafta Sonları** — cumartesi-pazarları tek tuşla işaretler.
- **Gün başlığına tıklayın** — o günün tüm sütununu doldurur
  (bayram, kar tatili, toplu izin için).

**Toplamlar kendiliğinden hesaplanır** — sağdaki Ç / İ / R / Diğ. / Boş
sütunları anında güncellenir. **Boş** sütunu 0 olana kadar ay bitmemiştir;
alt çubukta kaç boş hücre kaldığı yazar.

### Personel ve kadro

İki ayrı kavram, karıştırmayın:

- **Personel** (üst çubuk) — şirketin tüm çalışan listesi. Kişi bir kez
  tanımlanır. İşten ayrılanı **silmeyin**, `Aktif` kutusunun işaretini
  kaldırın; geçmiş ayları olduğu gibi kalır.
- **Bu Ayın Kadrosu** (araç çubuğu) — o ayın cetvelinde kimlerin satırı
  olacağı. Yeni giren birini o aya ekler, o ay çalışmayanı çıkarırsınız.
  Diğer aylar etkilenmez.

Bir aya ilk kez veri girdiğinizde o ayın kadrosu **dondurulur**. Böylece
sonradan işe alınan biri geçmiş ayların cetvelinde görünmez.

### Excel'e aktarma

**Excel'e Aktar** üç seçenek sunar:

- **Sadece bu ay** — imzaya/arşive gidecek tek sayfalık cetvel.
- **Bu yılın tamamı** — 12 ay sayfası + kontrol paneli.
- **Tüm aylar** — bütün geçmiş, tam arşiv.

Çıkan dosya sıradan bir tablo değil, hazır kurulmuş bir çalışma kitabıdır:

**Ay sayfaları**

- **Sabit 31 gün sütunu (D–AH).** Kısa aylarda olmayan günler gri ve
  kilitlidir. Bu sayede toplam formülü her ayda aynıdır (`D:AH`) — eski
  dosyadaki "aralık ayın gün sayısıyla uyuşmuyor" hatası yapısal olarak
  imkânsız hale gelir. Toplam sütunları da her ayda tam aynı yerdedir.
- **DURUM sütunu** — satır tamamsa yeşil `✓ TAMAM`, eksikse turuncu
  `⚠ 3 gün eksik`. Ayın bittiğini gözle taramadan görürsünüz.
- **7 toplam sütunu** — Çalışılan / İzinli / Raporlu / Yarım Gün /
  Devamsız / Ücretsiz İzin / Doğum İzni + Toplam İşlenen.
- **Süzgeç (filtre)** başlık satırında — sadece SAHA'yı, sadece eksik
  satırları ya da 5'inde izinli olanları listeleyebilirsiniz.
- **Bilgi şeridi** — ayın adı, gün sayısı, kişi sayısı ve o ayın resmî
  tatilleri en üstte yazılı.
- **Donmuş bölme** — isim sütunu ve başlık satırı hep ekranda.
- **Kod renkleri** koşullu biçimlendirmeyle gelir, elle yazdığınız da renklenir.
  Tanınmayan bir kod yazarsanız hücre **kırmızıya** döner.
- **Açılır liste** ve kod ipucu balonu her gün hücresinde.
- **Hafta sonu ve resmî tatil** sütunları renkli.
- **Günlük çalışan sayısı** satırı en altta.
- **İmza bloğu** — Hazırlayan / Kontrol Eden / Onaylayan.
- **Baskıya hazır** — A4 yatay, tek sayfa enine sığar, başlık satırı her
  sayfada tekrarlar, altbilgide ay adı ve sayfa numarası.
- **Sayfa koruması** — formül sütunlarına yanlışlıkla yazılamaz. İsim, TC,
  çalışma yeri ve gün hücreleri serbesttir. Kaldırmak için:
  *Gözden Geçir → Sayfa Korumasını Kaldır* (parola yok).

**KONTROL PANELİ sayfası** (yıl/tüm arşiv aktarımlarında)

Kişi × ay tablosu. Üstteki açılır listeden *Çalıştı / İzinli / Raporlu…*
seçersiniz, tablo **anında** o koda göre dolar — canlı `VLOOKUP`
formülleri ay sayfalarından okur. Yıl toplamı ve aylık toplam satırı hazır.

**PERSONEL sayfası** — tüm kadro, durumu ve kaç ayda kaydı olduğu, süzgeçli.

**KODLAR sayfası** — kod tanımları. Kontrol paneli bu listeyi kullanır,
silmeyin.

### Yıllık özet

**Yıllık Özet** düğmesi kişi × ay tablosunu verir: her ay kaç gün
çalışıldığı (ya da izin/rapor), yıl toplamıyla birlikte. CSV olarak
indirilebilir.

### Yazdırma

**Yazdır** düğmesi A4 yatay, tek sayfaya sığacak biçimde çıktı verir.
Yazdırma penceresinde "Hedef → PDF olarak kaydet" seçilirse PDF üretir.

### Veriler nerede duruyor?

Veriler **bu bilgisayarın tarayıcısında** saklanır — sunucuya, buluta
hiçbir şey gitmez. Bunun iki sonucu var:

- Başka bilgisayardan aynı verilere ulaşamazsınız.
- Tarayıcı verilerini temizlerseniz puantaj da silinir.

Bu yüzden **ayda bir yedek alın**: ⚙ → *Yedek Al (.json)*. Yedeği
şirket ağındaki bir klasöre koyun. Geri yüklemek için aynı yerden
*Yedekten Yükle*.

Başka bilgisayara taşımak için de yedek dosyasını kullanın.

### Puantaj kodları

| Kod | Anlamı |
|---|---|
| `Ç` | Çalıştı |
| `İ` | İzinli |
| `R` | Raporlu |
| `Y` | Yarım gün |
| `D` | Devamsız |
| `Ü` | Ücretsiz izin |
| `Dİ` | Doğum izni |

Hafta sonları gri, resmî tatiller kırmızı gösterilir. Bu sadece
**görsel uyarıdır** — hücreleri kendiliğinden doldurmaz, 7 gün çalışılan
işlerde de aynı şekilde kullanılır. Dinî bayram tarihleri 2017-2030
arası için tanımlıdır.

---

## 2. Eski Excel'i onarma — `tools/duzelt.py`

Excel'de devam etmeyi tercih ederseniz, mevcut dosyanızdaki hataları
düzeltir. Orijinal dosyaya dokunmaz, yanına düzeltilmiş bir kopya çıkarır.

```bash
pip install openpyxl
python3 tools/duzelt.py "PUANTAJ CETVELİ.xlsx"
```

Düzelttiği üç şey:

1. **Yanlış COUNTIF aralıkları.** Sayfalar birbirinden kopyalandığı için
   toplam formülleri ayın gün sayısıyla uyuşmuyor — 31 günlük bir ayda
   izin sayımı `D:AG` (30 gün) yapılıp ayın 31'i hiç sayılmıyor.
2. **Büyük/küçük harf tutarsızlığı.** Hücrelere kimi zaman `ç` / `i`,
   kimi zaman `Ç` / `İ` yazılmış. `COUNTIF(...;"İ")` küçük `i` yazılmış
   günleri saymayabiliyor.
3. **Başlıktaki yanlış tarih.** Sayfa kopyalanırken güncellenmemiş.

Ayrıca kodlara renk, gün hücrelerine açılır liste, başlık satırına
dondurma ve hafta sonu vurgusu ekler. Sadece hataları düzeltip
görünüme dokunmaması için `--sade` seçeneğini kullanın.

Çalıştırınca neyin değiştiğini satır satır raporlar.

---

## Sık sorulanlar

**Aynı anda iki kişi kullanabilir mi?**
Hayır. Veriler tek bilgisayarda durur. İki kişi girecekse ayları
bölüşün ve yedek dosyalarını birleştirmek yerine Excel'e aktarıp
tek dosyada toplayın.

**Yanlışlıkla ayı temizledim.**
`Ctrl + Z` son işlemi geri alır (son 40 işlem saklanır). Uygulamayı
kapattıysanız yedekten dönmeniz gerekir.

**Excel'den aktarınca kişiler ikiye katlandı.**
Eşleştirme önce TC No, o yoksa ad-soyad üzerinden yapılır. Aynı kişi
farklı yazıldıysa (ör. *Atila Sanlı* / *Atilla Şanlı*) iki kayıt oluşur.
**Personel** ekranından birini silip diğerinde birleştirin — silmeden
önce ⚙ → *Yedek Al* demeyi unutmayın.

**Tarayıcı "dosya güvenli değil" diyor.**
Bilgisayarınızdaki bir HTML dosyasını açtığınız için normaldir; dosya
internete hiçbir şey göndermez, kaynak kodun tamamı `index.html` içinde
okunabilir durumdadır.
