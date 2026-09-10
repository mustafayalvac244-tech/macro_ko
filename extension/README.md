# Vekil Pro — Chrome Eklentisi

Açık olan sayfadaki dava bilgilerini okuyup Vekil Pro'da dosya açar.

## Neden UYAP'a bağlı değil

Eklenti UYAP'ın HTML yapısına **bakmıyor**. Sayfanın görünen metnini alıp,
mobil uygulamanın da kullandığı `ai-chat` ucuna (`mode: 'kunye'`) gönderiyor;
alanları sunucu çıkarıyor.

İki sebep:

1. **Seçiciler kırılır.** UYAP arayüzünü değiştirdiği gün CSS/XPath seçicileri
   sessizce boş dönerdi — kullanıcı bunu ancak dosyası eksik açıldığında fark
   ederdi.
2. **İki çıkarıcı ayrışır.** Mobilde bir, eklentide başka bir çıkarma mantığı
   olsaydı zamanla farklı sonuç verirlerdi. Bu oturumda tam bu sınıftan üç kusur
   çıktı (bildirim metni, kimlik şeması, aşama ekleri).

Yan fayda: sayfa UYAP mı, e-Devlet mi, bir PDF görüntüleyici mi — fark etmiyor.

## Gizlilik ve izinler

- `activeTab` + `scripting`: sayfa metni **yalnız siz düğmeye bastığınızda**
  okunur. Arka planda sürekli dinleyen bir content script **yok**.
- `storage`: yalnız oturum jetonu tutulur. **Şifre saklanmaz.**
- Geniş `host_permissions` **istenmiyor** — "hangi sitelerimi okuyor?" sorusunun
  cevabı: yalnız bastığınız andaki sekme.

## Kurulum (geliştirici modu)

1. Chrome → `chrome://extensions`
2. Sağ üstten **Geliştirici modu**'nu açın
3. **Paketlenmemiş öğe yükle** → bu `extension/` klasörünü seçin
4. Araç çubuğundaki simgeye tıklayıp Vekil Pro hesabınızla giriş yapın

## Kullanım

1. UYAP'ta (ya da herhangi bir sayfada) dosyayı açın
2. Eklenti simgesine tıklayın → **Bu sayfadan dosya aç**
3. Bulunan alanları **kontrol edin** — çıkarılamayan alan "bulunamadı" der,
   tahmin edilmez
4. **Dosyayı oluştur**

## Bilinen sınırlar (dürüstlük notu)

- Alan çıkarma ölçümü **yedi senaryodur** ve o setin tamamı geçmiştir
  (20 alanın 20'si doğru, sıfır uydurma). Bu ince bir settir ve özellik gerçek
  kullanıcıda henüz ölçülmedi.
- Her istek, ücretsiz kullanıcının **yaşam boyu 3 deneme hakkından birini**
  harcar (mobil uygulamadaki ile aynı havuz).
- Plan limiti sunucuda uygulanır: ücretsiz planda dava hakkı dolmuşsa eklenti de
  kayıt açamaz.
- Mağazaya **yayınlanmadı**; şu an yalnız geliştirici modunda yüklenebilir.
