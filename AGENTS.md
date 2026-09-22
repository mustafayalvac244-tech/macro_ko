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

## Bol keseden sayı sallamak yasak (19.09.2026, ürün sahibi kuralı)

Bir sayı yazarken — süre, boyut, sıklık, eşik, bekleme, limit — o sayı ya
**ölçülmüş** olacak ya da yanında **"ölçülmedi, tahmin"** yazacak. Üçüncü bir
seçenek yok. "Herhâlde bu kadar sürer" diye yazılan sayı uydurmadır.

Aynı gün yapılmış üç ihlal:

- **240 saniyelik körlemesine bekleme.** Bir iş akışı koşusunun ne kadar
  sürdüğü hiç ölçülmeden "240 saniye bekle" yazıldı. Ölçüldüğünde koşu
  **58 saniye** sürüyordu. Ürün sahibi dakikalarca boşuna bekledi ve
  haklı olarak sordu: "sana koy diyen oldu mu?" Hayır, kimse demedi.
- **"Veritabanı 7,5 saat bağlantı kabul etmedi."** Ölçülmemişti. Postgres
  kayıtları okununca ağır tıkanmanın **~1 saat** sürdüğü, sonrasının saatte
  ~40 hatayla aksak ama çalışır olduğu görüldü. Hatanın büyüklüğünü abartmak
  da yanlış bilgidir; bu kural küçültmeyi de büyütmeyi de yasaklar.
- **"16 işçi uygulandı."** Göç koşusu düşmüştü, doğrulanmadan "uygulandı"
  denildi. Sistem hâlâ 8'deydi.

**İhlal yok. Uydurma yok.** Ölçmediysen sayı yazma.

## Bekleme yasak (19.09.2026, ürün sahibi kuralı)

Bir iş bitene kadar beklemek gerekiyorsa, bekleme süresi **işin gerçek
süresinden** gelir; içinden geçtiğin duyguyla ya da "garanti olsun" payıyla
değil.

- İşin ne kadar sürdüğünü **bilmiyorsan önce ölç**: bir kez koştur, damgaları
  çıkar (`created_at` → `completed_at`), sonraki beklemeyi ona göre kur.
- Ölçtükten sonra beklemeyi **o süreye yapıştır**, üstüne "olur da" payı ekleme.
- Sonuç geldiği **an** yaz. Elinde sonuç varken beklemeye devam etmek,
  kullanıcıyı bekletmektir.

Ölçüldü (19.09.2026): `ios-dagit.yml` denetim koşusu **58 saniye**
(18:48:44 → 18:49:42, GitHub damgaları). Buna 240 saniye bekleme kuruldu.

## Verimsiz iş yasak (19.09.2026, ürün sahibi kuralı)

Kullanıcının parasıyla ve zamanıyla çalışıyorsun. Aşağıdakiler yasak:

- **Sonucu değiştirmeyen tekrar.** Aynı durumu üst üste sorgulamak, biten bir
  işi tekrar tekrar yoklamak. Bir kere bak, sonucu al, yaz.
- **Gerekmeyen adımı koşturmak.** Salt okunur bir denetim için derleme aracı
  kurmak gibi. Adım işe yaramıyorsa o kipte koşmasın.
- **Peşini bırakamamak.** Çalışan bir şeyi "biraz daha iyi olsun" diye
  kurcalamak. 8 işçi yeterliyken 16'ya çıkarma denemesi iki kez düştü ve
  kazandıracağı şey zaten gerekli değildi.
- **Aracı doğrulamadan ölçüm üstüne ölçüm yapmak.** Aynı gün üç sonda atıldı,
  üçü de aynı hatayı verdi; sebep Apple'ın şeması değil, gövdeyi JSON'a
  çevirmeyen kendi yardımcımızdı. Üç koşu boşa gitti.

Ölçüt basit: **bu adım olmasaydı sonuç değişir miydi?** Değişmiyorsa yapma.

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
- **DİSK MALİYETİ KONUSU KAPANDI (13.09.2026, ürün sahibi kararı).** Eczane
  tablolarının aynı Supabase faturasına yazıldığı ölçülüp raporlandı; ürün
  sahibinin cevabı: *"ilaçpro daha fazla yer kaplamıcak, kaplarsa
  genişletirim."* Yani tabloların orada durması ve büyürse planın
  büyütülmesi **bilinçli bir karardır**. Bunu tekrar maliyet gerekçesiyle
  gündeme getirme; ölçüm istenirse yapılır, uyarı tekrarlanmaz.
  (KVKK ayrımı gerekçesi bundan AYRIDIR ve yukarıdaki kurallar aynen geçerli:
  bu depoya sağlık verisi şeması hâlâ girmez.)
- Eczane uygulaması için devir notu `MIMARI-DEVIR.md`'dedir; oradaki mimari
  bilgisi paylaşılır ama **veritabanı paylaşılmaz**.
- `tests/saglikVerisiAyrimi.test.ts` bu kuralı kod tarafında koruyor: depoya
  sağlık verisi şeması sızarsa test düşer.

# Bu depodaki skill'ler — tetiklenmezse elle oku

`.claude/skills/` altında dört skill var. Normalde işin konusuna göre
kendiliğinden yüklenirler, ama tetikleme garanti değil: bir skill
yüklenmediğinde sessizce yüklenmez, uyarı çıkmaz. O yüzden aşağıdaki
işlerden birine başlıyorsan ilgili dosyayı elle oku.

| Skill | Ne zaman | Neden var |
|---|---|---|
| `once-dusun` | Canlıyı değiştiren HER işten önce: bir ayar sayısını büyütürken (işçi, eşzamanlılık, sıklık, limit), cron kurarken, uç dağıtırken, göç uygularken, dış servise yazarken, teşhis söylerken, koruma testi yazarken | 18/19.09.2026: vektörleme işçisi 64'e çıkarıldı. Ağır tıkanma bir saat sürdü (22:00'de 879 Postgres hatası), sonrasında gece boyu saatte ~40 hatayla aksak çalıştı. Sebep işçi sayısı değil, her çağrıda koşan 70 bin satırlık bir sayımın 64 ile çarpılmasıydı — ve uyarı (`"remaining":null`) ekrandaydı, üstünden geçildi. |
| `olcum` | Bir sayı, oran, hız, boyut ya da "durum ne" iddiası üretirken; rapor, kıyas, teşhis yazarken; bir aracın bize uygun olup olmadığına karar verirken | Kendi ölçümünle kendini kandırmamak. En pahalı hata: bir ölçüm dosyasının içindeki eskimiş sabite bakıp ürün sahibine "9 gün" demek — doğrusu 76'ydı. |
| `supabase-goc` | `supabase/migrations/` altına dosya yazarken, şema/RLS/RPC/indeks işinde, "canlıda şu var mı" ölçerken | Çok ifadeli dosya tuzağı, `to_regclass`ın ayrıştırmayı korumaması, sütun adı varsaymak, pg_cron şeması, yerel deneme koşusu. |
| `rn-ui-kit` | Ekran, bileşen, layout, stil, tema, navigasyon işinde | 5 tema (sabit hex 5'inde birden bozulur), `typography.*` stil nesnesidir, `colors.text` yoktur, 25 hazır `ui/` bileşeni. |

**Kural:** bir skill'e yeni bir ders eklerken **gerçekten olmuş bir olaya**
dayandır ve tarihini yaz. Genel tavsiye, skill'i uzatır ve hiçbir şeyi
önlemez — bugüne kadar önlenen her hatanın arkasında somut bir olay var.


## Dışarıdan gelen skill'ler — bize UYMAYANLAR (ölçüldü 22.09.2026)

Yukarıdaki dört skill bu depoya ait. Ama oturuma hesap/paket seviyesinden
BAŞKA skill'ler de yükleniyor ve bazıları bu projede **yanlış iş yaptırır**.
Aşağıdakiler ölçülerek bulundu; henüz zarar vermediler, bu yüzden "olay"
değil "tuzak" olarak yazılıyorlar.

### 1. `anthropic-skills:rn-ui-kit` — KULLANMA, doldurulmamış şablondur

Hesap seviyesinde, adı bizimkiyle neredeyse aynı olan ikinci bir kopya var
(82 satır; bizimki 206). İçinde `#______` boş renk alanları ve
"[ ] NativeWind / [ ] StyleSheet" seçilmemiş kutular duruyor. Taşıdığı dört
kural bu depoda **yanlıştır** — bizim sürümümüz onları bilerek silmişti:

| Şablonun kuralı | Depodaki gerçek (22.09.2026) |
|---|---|
| "Görseller için `expo-image`" | 0 dosya kullanıyor |
| "Animasyon için `react-native-reanimated`" | 0 dosya kullanıyor |
| "150 satırı geçen bileşeni böl" | 121 `.tsx`'in 68'i geçiyor |
| "Her dokunulabilir öğeye `accessibilityLabel`" | 82 dosyanın 7'sinde var |
| "Paylaşılan bileşenler `components/` altında" | bizde `src/components/ui/` |

Doğru olan **`rn-ui-kit`** (ön ek yok, proje skill'i). Ön ekli olanı görürsen
yükleme; yüklendiyse kurallarını uygulama.

### 2. `claude-api` — "tek sağlayıcı" kuralı bizim mimarimizi kırar

Skill aynen şunu diyor: *"Never mix the two"* (resmî SDK ile ham HTTP aynı
projede karışmaz) ve *"default to Claude Opus 5"*.

Bizde ÖLÇÜLEN durum: `supabase/functions/ai-chat/index.ts` **hem**
`npm:@anthropic-ai/sdk` **hem** Gemini/GPT uçları için ham `fetch` kullanıyor.
Bu bir kaza değil, **katmanlı maliyet modelinin kendisi** (`_shared/katman.ts`,
`_shared/fiyat.ts`): ucuz işi `gpt-oss-20b`/`gemini-flash` yapar, pahalı işi
Claude'a çıkar. Skill'i harfiyen uygulamak iki zarar verir:
- ham `fetch` yolları "düzeltilir" → **Gemini yolu kırılır**,
- her şey Opus 5'e çekilir → **fatura katlanır**.

Claude tarafına dokunurken skill'in SDK bilgisi (model kimlikleri, adaptive
thinking, akış) **doğrudur ve kullanılır**; "tek sağlayıcı" ve "varsayılan
model" kısmı **bu depoda geçersizdir**.

### 3. `artifact-design` · `theme-factory` · `dataviz` — HTML üretirler, biz RN yazıyoruz

Üçü de "tema", "grafik", "görsel albeni" gibi kelimelerle tetikleniyor ve
Google Fonts + CDN + yayınlanmış HTML sayfası üretmeye götürüyor. Bizim
ekranlarımız React Native. Ürün sahibi "şu ekranı düzelt" dediğinde
**gerçek ekran dosyası düzeltilir**, yanına bir artifact sayfası açılmaz.
(İstisna: ürün sahibi açıkça web sayfası/artifact isterse geçerlidirler.)

### 4. `anthropic-skills:docs` · `loop` · `skill-creator` — token yakarlar

- `docs`: "rapor/özet" istendiğinde turn'ün İLK tool çağrısı belge iskeleti
  olsun der. "Durum ne" sorusuna belge açmak, sohbette iki satırla
  verilebilecek cevabı pahalılaştırır.
- `loop`: tekrarlayan uyandırma kurar — AGENTS.md'nin
  *"sonucu değiştirmeyen tekrar yasak"* kuralıyla doğrudan çelişir.
- `skill-creator`: tasarımı gereği her deneme için İKİ alt-ajan açar
  (skill'li + skill'siz) ve iterasyonlarca tekrarlar.

Üçü de ürün sahibi **açıkça isterse** koşar; kendiliğinden koşmaz.
