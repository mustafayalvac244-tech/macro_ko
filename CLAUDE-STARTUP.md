# Claude for Startups başvurusu — kontrol listesi

> **08.10.2026: CLAUDE CONSOLE HESABI ASKIYA ALINDI** ("unusual activity").
> Başvuru hesap açılana kadar BEKLER (Console hesabı şart). Sebep
> bilinmiyor. Aynı gün tarayıcıdaki Claude, Console'u ürün sahibinin açık
> oturumunda açmıştı; bu dosyadaki görev metni ona "Console'a benim hesabımla
> gir" diyordu. Ölçülen (08.10): son 24 saatte uygulamadan Claude'a 0 istek;
> son 10 günde ai_istek'te 18 Claude kaydı — kapatma uygulamanın
> kullanımından kaynaklanmış görünmüyor. Claude düşünce istekler yedek
> modele gidiyor (kullanıcıya "yedek modelle üretildi" yazar, hak düşmez);
> yedek hattın şu an çalıştığı ÖLÇÜLMEDİ (son görüldüğü 30.09).
> İnceleme talebi metni aşağıda ("Hesap inceleme talebi"). İnceleme ~10 gün,
> karar kesin: göndermeden önce tarayıcıdaki Claude'un o gün Console'da ne
> yaptığı kendi kaydından kontrol edilmeli.

Tarih: 08.10.2026. Ürün sahibi: *"Claude startup için ne gerekiyorsa baştan
sıra sıra yaz, bizde olan olmayan."*

Kaynak: Anthropic'in program sayfası (claude.com/programs/startups),
desteklenen ülkeler sayfası ve Kullanım Politikası (anthropic.com/legal/aup),
08.10.2026'da okundu. Program koşulları değişebilir; başvururken sayfaya
yeniden bakılmalı.

## Teklif (sayfada yazan)

- 1 yıl ücretsiz Claude Team, en çok 5 Premium koltuk (yalnız daha önce
  Team kullanmamış organizasyon)
- 1.000 $ API kredisi (verildikten 6 ay sonra biter; yalnız Console
  üzerinden doğrudan API'de geçer)
- Daha yüksek API limitleri, ortak indirimleri (45 bin $'a kadar)

## Şartlar ve bizdeki durum

| # | Şart | Durum | Not |
|---|---|---|---|
| 1 | Son 5 yılda kurulmuş ya da son 2 yılda yatırım almış | ✅ | Proje 2026 |
| 2 | Ülke desteklenmeli | ✅ | Türkiye hem API hem Claude.ai listesinde |
| 3 | Yayında web sitesi | ✅ | vekilpro.app |
| 4 | Claude Console hesabı | ✅ | Uygulamanın API anahtarı oradan. Başvuruyu AYNI organizasyondan yap ki kredi uygulamanın faturasına geçsin (çıkarım) |
| 5 | Siteyle aynı alan adında şirket e-postası | ❌ | Ölçüldü 08.10: vekilpro.app'te MX kaydı yok, hiçbir adres posta alamıyor. Çözüm: Cloudflare Email Routing → `bilgi@vekilpro.app` Gmail'e yönlenir (ücretsiz) |
| 6 | Ne yaptığımızın kısa açıklaması | ✅ | Aşağıda hazır |
| 7 | Kullanım politikası (hukuk "yüksek riskli" sayılıyor) | ⚠️ | AI bildirimi VAR: her AI çıktısında kapatılamaz uyarı (`src/components/ui/HukukiUyari.tsx`). İnsan denetimi: ürün avukat için, denetleyen avukat. AÇIK NOKTA: kayıtta baro sicil doğrulaması yok (DURUM #4), avukat olmayan biri de kullanabilir — başvuruya engel değil ama sorulursa cevabı ürün sahibinin kararı |
| 8 | Team teklifi için: organizasyon daha önce Team kullanmamış | ? | Ürün sahibi bilir |
| 9 | Daha önce Anthropic startup kredisi almamış | ? | Eski rehberlerde vardı, yeni sayfada görülmedi |

İsteğe bağlı (başvuru için şart değil): kutu çalışınca sitenin altına
`bilgi@vekilpro.app` iletişim adresi yazmak. KVKK açısından da eksik
(DURUM #6). Site değişikliği olduğu için önce ürün sahibine gösterilir.

## Başvuru metni (forma yapıştırılacak) — 08.10 DOĞRULANMIŞ SÜRÜM

Ürün sahibi: *"kesin almamız lazım, yanlış şeyler yazmayalım"*. İlk taslağın
her cümlesi koda ve canlı sisteme karşı denetlendi; düzeltilenler:

| İlk taslak | Sorun | Düzeltme |
|---|---|---|
| "summarizes case law" | Kodda AI karar özetleme işi yok | "drafts legal opinions, reviews documents" (`mutalaa.tsx`, `document-review.tsx`) |
| "client finances" | Finans modülü ücret/masraf tutuyor | "fees and expenses" |
| "Every case-law citation ... unverifiable ones are removed" | Yalnız bulunamayan Yargıtay künyeleri ve olanaksız künyeler çıkarılıyor; doğrulanamayanlar İŞARETLENİYOR (`ai-chat` > `kararAtfiDenetimiIc`) | Aynen bu ayrımla yazıldı |
| "which lawyers judge most strictly" | Ölçülmemiş iddia | Çıkarıldı; yerine belgeli gerekçe: sohbet maliyet için Haiku'da (05.10 kararı) |
| Tek uygulama | İlaç Pro da yayında (App Store, aynı geliştirici hesabı) | Tek cümle eklendi; Claude kullandığı İDDİA EDİLMEDİ |

Ölçülen gerçekler (08.10): Vekil Pro App Store'da ilk yayın 27.09.2026
(sürüm 3.4.0); İlaç Pro ilk yayın 28.09.2026 (sürüm 1.4.0, "Medical",
ücretsiz). Model eşlemesi `_shared/katman.ts`: sohbet + düzelt Haiku 4.5,
gerisi Sonnet 5. Sohbette uyarı çubuğu her zaman görünüyor; dilekçe,
mütalaa, belge inceleme ve dosya aktarmada kapatılamaz AI uyarısı var.

**ÜRÜN SAHİBİNİN KARARI (forma girmeden önce):**
- **Kurucu:** App Store'daki geliştirici hesabı ürün sahibinden farklı bir
  kişinin adına. Formda kurucu(lar) gerçek duruma göre yazılmalı; iki isim
  arasındaki ilişki sorulursa açıklanabilir olmalı.
- **Yatırım:** "Bootstrapped" (dış yatırım yok) varsayıldı, doğrulanmadı.
- **Kullanıcı / gelir sayısı** sorulursa: tahmin yazılmaz, o gün ölçülür.

- **Company name:** Vekil Pro
- **Website:** https://vekilpro.app
- **Company email:** bilgi@vekilpro.app

**What are you building?**
Vekil Pro is a practice-management app with an AI assistant for lawyers in
Turkey. It tracks cases, hearings, statutory deadlines (including
judicial-recess rules), fees and expenses. Its AI drafts petitions and legal
opinions, reviews documents and answers legal questions. Case-law citations
in AI answers and drafts are checked against our index of Turkish court
decisions; Court of Cassation (Yargıtay) citations that are not in the index
are looked up in the official decision search. Citations the official search
cannot find, or that are internally impossible, are removed before the
lawyer sees the text, and any citation we could not verify is flagged.
Petitions can be exported in UDF, the document format of Turkey's national
judiciary system (UYAP). Vekil Pro has been on the App Store (Türkiye) since
September 27, 2026, and is also available on the web.

We also publish a second app, İlaç Pro (App Store, since September 28,
2026). It shows the official patient leaflet of a medicine when the barcode
on its box is scanned; the text is shown as published by the Turkish
Medicines and Medical Devices Agency, without added interpretation or dosing
advice.

**How do you use Claude?**
Vekil Pro calls the Claude API directly: Claude Haiku 4.5 for chat and quick
edits, and Claude Sonnet 5 for drafting petitions and legal opinions,
document review and legal research. Answers are grounded in retrieval over
Turkish court decisions and legislation, and AI output is labelled in the app
as AI-generated and not legal advice. We keep chat on Haiku to control cost;
credits would let us test Sonnet for chat as well.

## Tarayıcıdaki Claude'a verilecek görev

İlk görev (posta kutusu + form) 08.10'da verildi. Form metni bu dosyadaki
doğrulanmış sürümle DEĞİŞTİRİLMELİ; kurucu ve yatırım alanları ürün
sahibine sorulmadan doldurulmamalı.

## Bilinmeyenler

- Başvuru formunun içi görülmedi; alanlar farklı çıkabilir.
- Şirket kurulmamışsa (şahıs) kabul edilip edilmediği sayfada yazmıyor.
- Sonuç ne kadar sürede gelir: bilinmiyor.

## Hesap inceleme talebi (08.10) — Console "Request a review" formu

Doğrulanan (kodda): anahtar yalnız Supabase sırrı, istemciye girmiyor;
GitHub iş akışları ve betikler Anthropic'i doğrudan çağırmıyor.

**What do you use your account for?**
I use this account for the Claude API behind Vekil Pro (https://vekilpro.app),
a practice-management app for lawyers in Turkey, live on the App Store and the
web. All API calls come from our backend (Supabase Edge Functions, EU region);
the API key is stored only as a server-side secret and is never shipped in the
app. We use Claude Haiku 4.5 for chat and quick edits and Claude Sonnet 5 for
drafting petitions and legal opinions, document review and legal research.
Usage is low: we are an early-stage app with few active users.

**Anything else we should know?**
On October 8, 2026, the day of the hold, I used Claude in Chrome in my own
browser to set up a company email address for our domain and to work on our
Claude for Startups application, which included opening the Claude Console in
my existing signed-in session. If that automated browser session looked
unusual, this is the explanation. I am happy to provide any further details.
