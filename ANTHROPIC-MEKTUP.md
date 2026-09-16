# Anthropic'e Tanışma Mektubu

> **16.09.2026.** Ürün sahibi kararı: kredi + "Claude ile çalışır" görünürlüğü
> için erken temas.
>
> **İçindeki her sayı bu depodan ya da canlı veritabanından ölçüldü.** Ölçüm
> zamanı: 16.09.2026 11:51 UTC. Gönderilmeden önce tazelenmeli — korpus saatte
> ~570 karar büyüyor, yani bir hafta bekleyen mektup yanlış sayı taşır.
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
| https://anthropic.com/contact-sales/startup-program | kredi | **Şart: kurumsal yatırımcıdan öz sermaye yatırımı.** Yatırım yoksa bu kapı kapalı — yine de form üzerinden yazmak ücretsiz |
| contact-sales (genel) | hacim fiyatı / tanışma | Asıl hedef bu |

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

**Why Turkey is an underserved market.** There are over 200,000 registered
lawyers in Turkey (Union of Turkish Bar Associations). Existing practice
software is priced around 50,000 TRY per year, so a product with a few
thousand subscribers reaches nine-figure TRY annual revenue. Almost none of
these tools do real legal-AI work, and none of them work well in Turkish.

**What I have built.** The product is a React Native / Expo app with a
Supabase backend. Alongside it I run a continuous harvester that builds a
Turkish case-law corpus. Measured today, 16 September 2026:

| | |
|---|---|
| Full-text court decisions | **66,870** |
| Added in the last 24 hours | **13,438** |
| Case-number catalogue rows | **2,513,592** |
| Extracted statute citations | **104,679** |
| Corpus size on disk | **2.2 GB** |

This corpus is the part I think matters. It is not licensed from anyone; it is
harvested, de-duplicated, indexed for full-text and semantic search, and it
grows around 570 decisions per hour without supervision. Retrieval over it is
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

**Where I am.** The product is pre-launch. Android is in closed testing and
iOS is about to enter TestFlight. I have no outside investment; everything
above was built and paid for solo.

**What I'm asking.**
1. Am I eligible for startup credits, given I have no institutional equity
   funding? If not, I'd like to discuss volume pricing as usage grows.
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

**Türkiye neden ihmal edilmiş bir pazar.** Türkiye'de 200 binden fazla kayıtlı
avukat var (TBB). Mevcut büro yazılımları yıllık 50.000 ₺ bandında
fiyatlanıyor; yani birkaç bin aboneli bir ürün yüz milyon ₺ mertebesinde
yıllık gelire ulaşıyor. Bu araçların neredeyse hiçbiri gerçek hukuki yapay
zekâ işi yapmıyor ve hiçbiri Türkçede iyi çalışmıyor.

**Ne kurdum.** Ürün React Native / Expo ve Supabase üzerinde. Yanında kesintisiz
çalışan bir hasat sistemi Türkçe içtihat korpusu kuruyor. Bugün ölçülen
(16 Eylül 2026):

| | |
|---|---|
| Tam metinli mahkeme kararı | **66.870** |
| Son 24 saatte eklenen | **13.438** |
| Karar numarası kataloğu | **2.513.592** satır |
| Çıkarılmış kanun maddesi atfı | **104.679** |
| Korpusun disk boyutu | **2,2 GB** |

Bence asıl önemli kısım bu korpus. Kimseden lisanslanmadı; hasat edildi,
yinelenenler ayıklandı, tam metin ve anlamsal arama için indekslendi ve
gözetimsiz olarak saatte ~570 karar büyüyor. Claude'un uydurma yerine gerçek
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

**Neredeyim.** Ürün henüz yayında değil. Android kapalı testte, iOS
TestFlight'a girmek üzere. Dışarıdan yatırım almadım; yukarıdakilerin tamamı
tek başıma kuruldu ve ödendi.

**Ne istiyorum.**
1. Kurumsal öz sermaye yatırımım olmadığı hâlde girişim kredilerine uygun
   muyum? Değilsem, kullanım büyüdükçe hacim fiyatlandırmasını konuşmak
   isterim.
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

## Bu mektupta BİLEREK OLMAYAN şeyler

- **Kullanıcı sayısı vaadi yok.** Sıfır kullanıcı var ve mektup bunu açıkça
  söylüyor ("pre-launch"). Gizlemek, ilk soruda çökerdi.
- **Ortaklık kelimesi yok.** Marka kuralları ortaklık imasını yasaklıyor;
  mektubun kendisi o çizgiyi aşmamalı.
- **Abartılı kalite iddiası yok.** "11/11" ölçümü modelin ve tarihin künyesiyle
  yazıldı, çünkü o ölçüm Opus'ta yapıldı ve ürün bugün Sonnet kullanıyor.
  Sonnet'te tekrarlanmadı; mektup bunu ima etmiyor.
