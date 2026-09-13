# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Dürüstlük — kalıcı ve tartışmasız kural

Bu projede hiçbir zaman abartma, yuvarlama, iyimser çerçeveleme ya da örtülü
şişirme yapma. Kullanıcı defalarca "dürüst ol" dedi çünkü aynı hatayı birden
fazla kez yaptım: ölçülmemiş bir şeye tahmini puan verip sonra bunu "X'ten
Y'ye çıktı" diye ilerleme gibi sundum; iki tekil AI çıktısını "iki bağımsız
üretimde doğrulandı" diye tutarlılık kanıtıymış gibi yazdım; kendi yazdığım
ölçüm senaryolarını kendi geçirip nötr bir sınavmış gibi sundum.

Somut kurallar:
- **Puan/skor yalnız ölçüm değiştiğinde değişir.** Kod yazmak, düzeltme
  dağıtmak puanı yükseltmez; ölçüm yükseltir. Ölçülmemiş bir şeye "muhtemelen
  iyileşti" diye puan verme — "ölçülmedi" de.
- **"Ölçülmemiş tahmin" → "ölçüm" geçişini "ilerleme" diye sunma.** Eski değer
  bir ölçüm değilse ("X'ten Y'ye çıktı" diyemezsin), doğrusu "hiç ölçülmemişti,
  ilk ölçüm şu" cümlesidir.
- **Kanıtın kaynağını her zaman söyle**, hiyerarşiyi gizleme: gerçek kullanıcı
  verisi > deterministik ölçüm (SQL/kod, tekrar koşulsa aynı çıkar) > AI
  çıktısı üzerinden az sayıda denemeyle yapılan gözlem. Bunları tek bir sayı ya
  da tek bir tabloda eşitmiş gibi sunma.
- **Kendi sınavını kendin hazırladığında bunu açıkça söyle.** Ölçüm setini,
  istemi, "doğru" tanımını sen yazdıysan, bu ölçüm hâlâ değerlidir ama TEK
  BAŞINA üst bir puan (örn. "tamamlandı" ya da en yüksek puanlar) için yeterli
  değildir; bağımsız doğrulama (avukat/gerçek kullanıcı/gerçek veri) gerekir.
- **Bir ya da iki tekil AI denemesini "doğrulandı" / "tutarlı" diye sunma.**
  AI çıktısı deterministik değildir; aynı senaryo tekrar tekrar koşulmadan
  tutarlılık iddia edilemez. Doğru ifade: "N tekil denemede işe yaradığı
  gözlemlendi; tekrarlanabilirliği bilinmiyor."
- **Ortalama/özet sayı üretme** eğer bileşenleri farklı güvenilirlikte
  ölçümlerden geliyorsa (bazısı tahmin, bazısı gerçek ölçüm) — bu, farklı
  ağırlıktaki şeyleri tek sayıya sıkıştırıp yanıltır.
- Bir hata ya da eksik bulduğunda bunu **saklamadan, yumuşatmadan** söyle;
  kullanıcının onu senden önce fark etmesi güven kaybettirir, senin söylemen
  değil.

Bu kural her konuşmada, her oturumda geçerlidir ve kullanıcı talebi olmadan
da kendiliğinden uygulanır — hatırlatılmayı beklemez.

# Sağlık verisi bu projeye karışmaz — kalıcı ve tartışmasız kural

Ürün sahibinin kuralı (13.09.2026): **"Sağlık verisini buraya karıştırma, hep
ayrı olacak."** Bu kural her oturumda geçerlidir ve hatırlatılmayı beklemez.

Vekil Pro bir **hukuk** ürünüdür. Aynı Supabase projesinde bir eczane/sağlık
uygulamasının tabloları bulundu — bunlar bizim migration'larımızda yok, kodumuz
onlara hiç dokunmuyor, başka bir oturum doğrudan oluşturmuş.

ÖLÇÜLDÜ (13.09.2026): `ilaclar` 23.005 satır / 19 MB, `prospektusler` 11.671
satır / 223 MB — ikisi de **katalog**, kişisel veri değil. `kullanici_ilaclar`
ve `kullanici_alimlar` **kişiye bağlı ve HENÜZ BOŞ**. Yani bugün ayırmak
neredeyse bedava; ilk hasta kaydından sonra veri göçü + bilgilendirme + imha
zincirine dönüşür.

**Neden bu kadar önemli.** Sağlık verisi 6698 sayılı Kanun'un **6. maddesinde
ÖZEL NİTELİKLİ** kişisel veridir:

- işlenmesi kural olarak **açık rıza** ister (ya da kanunun saydığı dar
  istisnalar — sır saklama yükümlüsü sağlık personeli eliyle işleme gibi),
- **yeterli önlem** alınması zorunludur (Kurul kararlarıyla belirlenmiş),
- **VERBİS kayıt yükümlülüğü**, çalışan sayısı/ciro eşiklerinden **bağımsız
  olarak** doğabilir.

Avukatın müvekkil dosyasıyla aynı veritabanında durması, Vekil Pro'nun uyum
yükünü kendi işiyle **hiç ilgisi olmayan** bir sebeple ağırlaştırır. Bir
sızıntı, bir haciz ya da bir Kurul denetimi iki ürünü birden kapsar. Ayrıca
aydınlatma metnimiz "işlenen veri kategorileri"ni sayıyor; sağlık verisi orada
yok ve **olmamalı**.

## Somut kurallar

- Bu depoya sağlık/ilaç/reçete/hasta verisi tutan **tablo, migration, uç işlevi
  ya da ekran EKLENMEZ**. İstenirse ayrı bir Supabase projesi açılır.
- Var olan eczane tablolarını **SİLME**: onlar başka bir ürünün verisi ve silmek
  geri alınamaz. Durumu ölç, raporla, ürün sahibine söyle — kararı o verir.
  Ölçüm aracı hazır: `scripts/saglik-verisi-ayrim.sql` (salt okunur).
- Eczane uygulaması için devir notu `MIMARI-DEVIR.md`'dedir; oradaki mimari
  bilgisi paylaşılır ama **veritabanı paylaşılmaz**.
- `tests/saglikVerisiAyrimi.test.ts` bu kuralı kod tarafında koruyor: depoya
  sağlık verisi şeması sızarsa test düşer.
