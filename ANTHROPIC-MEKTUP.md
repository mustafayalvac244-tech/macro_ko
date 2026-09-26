# Anthropic'e Tanışma Mektubu

> **16.09.2026.** Ürün sahibi kararı: kredi + "Claude ile çalışır" görünürlüğü
> için erken temas.
>
> **İçindeki her sayı bu depodan ya da canlı veritabanından ölçüldü.** Ölçüm
> zamanı: 17.09.2026 18:24 UTC. Gönderilmeden önce tazelenmeli — korpus saatte
> ~510 karar büyüyor, yani bir hafta bekleyen mektup yanlış sayı taşır.
>
> **KAYNAĞI OLMAYAN HİÇBİR RAKAM YOK.** Özellikle rakip cirosu YAZILMADI:
> o bilgi bir ödeme kuruluşu çalışanından geldi ve (a) aritmetiği tutmuyordu
> (50.000 ₺ × 2-3 bin kullanıcı = 8-12 milyon ₺/ay, iddia 20 milyon ₺/ay
> idi), (b) yazılı bir iş mektubunda kaynak gösterilmesi o kişiyi 6493 sayılı
> Kanun kapsamında riske atardı. Yerine kamuya açık fiyat bandı ve avukat
> sayısı kullanıldı.

---

## Gönderilecek yer

| kanal | ne için | not |
|---|---|---|
| https://anthropic.com/contact-sales/startup-program | kredi | **Yatırım ŞART DEĞİL** — ayrıntı aşağıda |
| contact-sales (genel) | hacim fiyatı / tanışma | Asıl hedef bu |

### Geri alma: "yatırım şart" iddiası yanlıştı (17.09.2026)

Bu dosyanın ilk hâlinde şöyle yazıyordu: *"Şart: kurumsal yatırımcıdan öz
sermaye yatırımı. Yatırım yoksa bu kapı kapalı."* **Kaynağı yoktu.**

**Anthropic'in kendi resmî şartlar sayfası** (`anthropic.com/startup-program-official-terms`,
17.09.2026'da okundu) bunu söylemiyor:

> *"Anthropic will consider multiple factors when evaluating applications,
> including, but not limited to, **business traction, investment, and
> funding**, as well as **Claude integration and usage**."*

Yani yatırım bir **değerlendirme ölçütü**, ön şart değil. Sayfada şirket yaşı
ya da "daha önce kredi almamış olma" şartı da yok.

Uygun olmayan ülkeler listesi var (Belarus, Çin, Küba, İran, Myanmar, Kuzey
Kore, Rusya, Sudan, Suriye, Kırım…) — **Türkiye listede yok.**

**Kapı kapalı değil.** Ama açık olması "gireriz" demek değil: baktıkları iki
şey iş çekişi ve Claude kullanımı, ve bugün ikisi de sıfıra yakın. Gerçek
engel yatırımsızlık değil, **kullanıcısızlık**.

**Marka kullanımı — sınırlar (kaynak: Anthropic marka kuralları):**
- ✅ Düz metinle "Claude ile çalışır" / "Powered by Claude"
- ❌ Ürün adında, logoda Claude/Anthropic
- ❌ Ortaklık / onay / destek ima etmek — yazılı izin gerekir

---

## MEKTUP (İngilizce — gönderilecek hâli)

**Subject:** Vekil Pro — Turkish legal practice software built on Claude

Hello,

I'm building **Vekil Pro**, a practice-management and legal-research product
for lawyers in Turkey. It runs on Claude and I'd like to talk about two
things: startup credits, and whether I may state publicly that the product is
built on Claude.

**The market.** There are over 200,000 registered lawyers in Turkey (Union of
Turkish Bar Associations), and the category is crowded. Counted on the Turkish
App Store in September 2026: **34** practice-management, case-tracking or
legal-research apps, of which **12 advertise an AI assistant** and **6 sell
access to a case-law or legislation database** — including long-established
publishers. So I am not going to tell you this is an empty market.

What I have that I have not seen elsewhere is a corpus I built rather than
licensed, and a retrieval layer that marks every statute reference and case
citation in the model's output as verified, not-found, or impossible. I have
not evaluated the competitors' output, so I make no claim about their quality;
I can only show you mine.

**What I have built.** The product is a React Native / Expo app with a
Supabase backend. Alongside it I run a continuous harvester that builds a
Turkish case-law corpus. Measured today, 17 September 2026:

| | |
|---|---|
| Full-text court decisions | **82,721** |
| Added in the last 24 hours | **12,295** |
| Case-number catalogue rows | **2,588,108** |
| Extracted statute citations | **130,486** |
| Corpus size on disk | **2.1 GB** |

This corpus is the part I think matters. It is not licensed from anyone; it is
harvested, de-duplicated, indexed for full-text and semantic search, and it
grows around 510 decisions per hour without supervision. Retrieval over it is
what lets Claude answer with real Turkish case law instead of plausible-
sounding invention — which in legal work is the only thing that matters.

**How I use Claude, and what I have measured.** I care a lot about not
fabricating law. The system prompt forbids writing a statute number, a
competent court, or a deadline unless it appears in retrieved context, because
I measured the model asserting the wrong competent court in a Turkish eviction
case. On a measured evaluation of 11 petition-drafting scenarios (Opus,
11 September) the output had zero fabricated dates and zero fabricated
citations.

I also route by task rather than by quota: petition drafting and legal
opinions always go to the strongest model, while classification and short chat
go to Haiku. That decision came from measuring real token sizes per task type,
not from guessing.

**Where I am.** The product is pre-launch. The iOS build is on TestFlight;
the Android closed test is set up but the 14-day tester requirement has not
started yet. I have no outside investment; everything above was built and paid
for solo.

**What I'm asking.**
1. I would like to apply to the Claude for Startups program. I have no
   institutional funding — your terms list funding as one factor among
   several, alongside traction and Claude usage, so I would rather be judged
   on the two things I can actually show you: the corpus, and how carefully
   the model is constrained. If credits are not a fit at this stage, I would
   like to discuss volume pricing as usage grows.
2. May I state on my website and in the app that Vekil Pro is built on Claude?
   Turkish lawyers are sceptical of AI, and naming the model they are actually
   talking to would do more for trust than anything I can say myself.

I'm happy to share the closed-beta usage data once it exists — I'd rather come
back with real numbers than promises.

Best regards,
[AD SOYAD]
Vekil Pro — vekilpro.app
[E-POSTA]

---

## MEKTUP (Türkçe — ne gönderdiğini bil diye)

**Konu:** Vekil Pro — Claude üzerine kurulu Türk hukuk yazılımı

Merhaba,

Türkiye'deki avukatlar için **Vekil Pro** adında bir büro yönetimi ve hukuki
araştırma ürünü geliştiriyorum. Claude üzerinde çalışıyor ve iki konuyu
konuşmak istiyorum: girişim kredileri, ve ürünün Claude üzerine kurulu
olduğunu açıkça söyleyip söyleyemeyeceğim.

**Pazar.** Türkiye'de 200 binden fazla kayıtlı avukat var (TBB) ve kategori
kalabalık. Eylül 2026'da Türkiye App Store'unda sayıldı: **34** büro yönetimi,
dava takip ya da hukuki araştırma uygulaması; bunların **12'si yapay zekâ
asistanı** iddia ediyor, **6'sı içtihat/mevzuat veritabanı** satıyor — aralarında
köklü yayıncılar var. Yani size "boş pazar" demeyeceğim.

Başkasında görmediğim şey şu: lisanslamadığım, kendim kurduğum bir korpus; ve
modelin çıktısındaki her kanun maddesini ve karar künyesini *doğrulandı*,
*bulunamadı* ya da *olamaz* diye işaretleyen bir erişim katmanı. Rakiplerin
çıktısını denemedim, o yüzden kaliteleri hakkında bir şey iddia etmiyorum;
yalnız kendiminkini gösterebilirim.

**Ne kurdum.** Ürün React Native / Expo ve Supabase üzerinde. Yanında kesintisiz
çalışan bir hasat sistemi Türkçe içtihat korpusu kuruyor. Bugün ölçülen
(17 Eylül 2026):

| | |
|---|---|
| Tam metinli mahkeme kararı | **82.721** |
| Son 24 saatte eklenen | **12.295** |
| Karar numarası kataloğu | **2.588.108** satır |
| Çıkarılmış kanun maddesi atfı | **130.486** |
| Korpusun disk boyutu | **2,1 GB** |

Bence asıl önemli kısım bu korpus. Kimseden lisanslanmadı; hasat edildi,
yinelenenler ayıklandı, tam metin ve anlamsal arama için indekslendi ve
gözetimsiz olarak saatte ~510 karar büyüyor. Claude'un uydurma yerine gerçek
Türk içtihadıyla cevap vermesini sağlayan şey bu — ki hukukta önemli olan tek
şey budur.

**Claude'u nasıl kullanıyorum ve ne ölçtüm.** Hukuk uydurmamayı çok
önemsiyorum. Sistem istemi, bir kanun maddesi numarasını, görevli mahkemeyi ya
da bir süreyi, bağlamda geçmiyorsa yazmayı yasaklıyor — çünkü modelin bir
tahliye davasında görevli mahkemeyi yanlış söylediğini ölçtüm. 11 dilekçe
senaryosundan oluşan ölçümde (Opus, 11 Eylül) çıktıda sıfır uydurma tarih ve
sıfır uydurma atıf vardı.

Ayrıca kotaya göre değil **işe göre** yönlendiriyorum: dilekçe ve mütalaa her
zaman en güçlü modele, sınıflandırma ve kısa sohbet Haiku'ya gidiyor. Bu karar
iş türü başına gerçek token boyutlarını ölçerek verildi, tahminle değil.

**Neredeyim.** Ürün henüz yayında değil. iOS derlemesi TestFlight'ta;
Android kapalı testi kuruldu ama 14 günlük test kullanıcısı şartı henüz
başlamadı. Dışarıdan yatırım almadım; yukarıdakilerin tamamı tek başıma
kuruldu ve ödendi.

**Ne istiyorum.**
1. Claude for Startups programına başvurmak istiyorum. Kurumsal yatırımım
   yok — şartlarınız yatırımı, çekiş ve Claude kullanımıyla birlikte
   değerlendirme ölçütlerinden biri olarak sayıyor; ben de gösterebileceğim
   iki şey üzerinden değerlendirilmeyi tercih ederim: korpus ve modelin ne
   kadar sıkı sınırlandırıldığı. Krediler bu aşamada uygun değilse, kullanım
   büyüdükçe hacim fiyatlandırmasını konuşmak isterim.
2. Web sitemde ve uygulamada Vekil Pro'nun Claude üzerine kurulu olduğunu
   belirtebilir miyim? Türk avukatlar yapay zekâya şüpheyle yaklaşıyor ve
   konuştukları modelin adını söylemek, benim söyleyebileceğim her şeyden daha
   çok güven kazandırır.

Kapalı beta kullanım verisi oluştuğunda paylaşmaktan memnuniyet duyarım —
vaatlerle değil gerçek sayılarla dönmeyi tercih ederim.

Saygılarımla,
[AD SOYAD]
Vekil Pro — vekilpro.app
[E-POSTA]

---

## Kimlik kilidi — izin gelince ne değişecek

**Ürün sahibi, 16.09.2026:** *"Şu an niye söyletmiyorum? Çünkü henüz iznim yok."*

Uygulamadaki kimlik kilidi (`ai-chat/index.ts` > KİMLİK) kalıcı bir ürün
kararı DEĞİL, bir uyum duruşu. İzin gelmeden asistanın "Claude ile
çalışıyorum" demesi açılmıyor.

**İzin gelirse:**
- Kilidin YALNIZ model adını söyleme kısmı gevşetilir.
- Sistem talimatlarını ve iç kuralları ifşa etmeme kısmı **aynen kalır** —
  o marka değil GÜVENLİK kuralı ve izinden bağımsız.
- Gevşetmek o noktada ŞART olur: tanıtımda "Claude ile çalışır" okuyan
  avukat, uygulamada sorduğunda "Ben Vekil AI'yım" cevabı alırsa bu güveni
  artırmaz, AZALTIR.

**İzin gelmezse:** kilit olduğu gibi kalır ve tanıtımda da Claude adı
kullanılmaz. İkisi birlikte hareket eder.

---

## Gönderilmeden önce yapılacaklar

- [ ] **AD SOYAD ve E-POSTA** doldur
- [ ] **TBB avukat sayısını tazele** — "200 binden fazla" yerine güncel resmî
      rakamı yaz ve nereden aldığını bil (soran olursa)
- [ ] **Korpus sayılarını tazele** — mektup bir hafta beklerse rakamlar eskir;
      sorgu `ANTHROPIC-MEKTUP.md` üstünde
- [ ] **Apilex cirosunu YAZMA** — gerekçe yukarıda

## Geri alınan iddia — rakip yokluğu (17.09.2026)

**Ürün sahibi:** *"piyasada 10'dan fazla bizim uygulama benzeri gördüm, yok
diyodun."*

**Haklıydı.** Mektubun ilk hâlinde şu cümle vardı ve **hiç ölçülmemişti:**

> *"Almost none of these tools do real legal-AI work, and none of them work
> well in Turkish."*

Ne bir uygulama sayılmıştı, ne biri denenmişti. Üstelik bu depodaki kural
(`AGENTS.md` + `olcum` skill'i) piyasa iddialarının da ölçüm istediğini
açıkça söylüyor; kural çiğnenen yer bizzat benim yazdığım mektuptu.

**ÖLÇÜLDÜ (iTunes Search API, TR mağazası, 17.09.2026).** Üç arama terimi
(`dava takip`, `büro yönetimi avukat`, `içtihat`) ile; devlet uygulamaları
(UYAP, e-Adalet, Celse, Resmî Gazete, YİM…), tek büroya ait uygulamalar ve
alakasızlar ayıklandıktan sonra:

| | |
|---|---|
| Benzersiz rakip uygulama | **34** |
| Bunlardan yapay zekâ asistanı iddia eden | **12** |
| İçtihat/mevzuat veritabanı satan | **6** |
| Ayıklanan | 14 devlet · 11 alakasız · 3 tek büro |

Yapay zekâ iddia edenler: Apilex, Yargı AI, De Jure AI, Huky AI, Avocate AI,
Arguman.ai, LexChat, Justly, Kanun Yolu, Avist, Hukas, Cübbe.
İçtihat/mevzuat veritabanları: **Kazancı**, **Sinerji Mevzuat**,
**Corpus Hukuk**, **KararVar**, AvukatApp, İçtihat Bülteni.

### Düzeltmenin kendisi de bir kez yanlış yazıldı

İlk düzeltmede cümle şöyle kurulmuştu: *"hiçbiri bir içtihat korpusu
yayımlamıyor."* Üçüncü arama sonucu gelince bunun da yanlış olduğu görüldü —
Kazancı ve Sinerji Türkiye'nin köklü içtihat veritabanı satıcıları, işleri
zaten bu. Yani bir ölçülmemiş iddia düzeltilirken yerine ikinci bir
ölçülmemiş iddia yazılmıştı.

**Ders:** bir iddiayı geri alırken yerine koyduğun cümle de bir iddiadır ve
aynı ölçümü ister. "Rakip yok" ile "rakiplerde şu yok" arasında kanıt
bakımından fark yoktur.

Mektuptaki paragraf artık rakipleri küçümsemiyor; yalnız kendi ölçülebilir
şeyini gösteriyor (kendi kurduğu korpus + atıf denetimi) ve rakiplerin
kalitesi hakkında hiçbir şey iddia etmiyor.

**Ölçümün sınırları:** `avukat` ve `hukuk` terimleri API hız sınırına takıldı,
alınamadı; yani **34 bir alt sınırdır**. Google Play hiç taranmadı. Hiçbir
rakibin çıktısı denenmedi.

Nitekim alt sınır olduğu doğrulandı: aynı gün yapılan web aramasında App
Store listesinde olmayan ürünler çıktı — **Jupytr, Jure, FulLegal, LexChat,
De Jure AI**. Bunlar web öncelikli, yani mağaza taraması onları hiç görmüyor.

---

## Hiç kimse hangi modeli kullandığını söylemiyor (17.09.2026)

**ÖLÇÜLDÜ, metin taraması.** 37 uygulamanın App Store açıklaması ve sürüm
notları indirildi ve şu kalıplar arandı: `claude|anthropic`,
`gpt|openai|chatgpt`, `gemini|google ai|vertex`, `llama|mistral`,
`kendi model|özel model|eğitilmiş model`.

| | |
|---|---|
| Taranan açıklama | **37** |
| Herhangi bir model adı geçen | **0** |

Web tarafı da aynı: Apilex'in platform sayfasında model adı yok (sayfa
okundu), De Jure AI'da yok, aramada hiçbir Türk hukuk yapay zekâsı bir
sağlayıcı adı vermiyor.

**Bunun ANLAMI ve ANLAMADIĞI şey.** Ölçülen: *kimse açıkça söylemiyor.*
Ölçülmeyen: *kimse kullanmıyor.* Çoğu muhtemelen bir sağlayıcı kullanıyor ve
adını vermiyor; bunu bilemem.

**Mektubun 2. talebini güçlendiren nokta bu.** 12 ürün "yapay zekâ asistanı"
diyor, hiçbiri neyin üstünde çalıştığını söylemiyor. "Claude ile çalışır"
diyen ilk Türk hukuk ürünü olmak, bugün piyasada karşılığı olmayan bir
konum — ve avukatın yapay zekâya duyduğu güvensizliğin tam da kaynağına
(kime güveneceğini bilememe) değiyor.

## Rahatsız edici bulgular — küçümsenmeyecek

- **Apilex "11-12 milyon içtihat" iddia ediyor** (kendi sitesinden okundu).
  Bizde 82.721 tam metin + 2.588.108 katalog satırı var. İddia doğrulanmadı
  ve "karar" ile "katalog kaydı"nı karıştırıyor olabilirler — ama korpus
  genişliğinde yarışmanın kaybedilecek bir savaş olduğu değişmiyor.
- **Türkiye Barolar Birliği kendi yapay zekâ asistanını yapıyor** ve çözüm
  ortakları çağrısı açmış. Üç kategoriden biri: *"Mevcut Ürün Sahipleri —
  çalışan prototipi ya da bitmiş ürünü olan şirketler."* Bu tarif Vekil Pro.
  200 bin avukatın çatı örgütü: rakip olursa en güçlüsü, ortak olursa en
  güçlü dağıtım kanalı.
  **DOĞRULANMADI:** çağrı Şubat 2026 tarihli, çalıştay Eylül'de sonuç
  paneliyle tamamlanmış görünüyor; başvuru penceresi kapanmış olabilir.
  TBB'nin **DavaTek** adlı bir uygulaması da var.

## Bu mektupta BİLEREK OLMAYAN şeyler

- **Kullanıcı sayısı vaadi yok.** Sıfır kullanıcı var ve mektup bunu açıkça
  söylüyor ("pre-launch"). Gizlemek, ilk soruda çökerdi.
- **Ortaklık kelimesi yok.** Marka kuralları ortaklık imasını yasaklıyor;
  mektubun kendisi o çizgiyi aşmamalı.
- **Abartılı kalite iddiası yok.** "11/11" ölçümü modelin ve tarihin künyesiyle
  yazıldı, çünkü o ölçüm Opus'ta yapıldı ve ürün bugün Sonnet kullanıyor.
  Sonnet'te tekrarlanmadı; mektup bunu ima etmiyor.
