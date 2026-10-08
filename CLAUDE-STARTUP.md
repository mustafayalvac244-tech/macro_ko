# Claude for Startups başvurusu — kontrol listesi

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

## Başvuru metni (forma yapıştırılacak)

- **Company name:** Vekil Pro
- **Website:** https://vekilpro.app
- **Company email:** bilgi@vekilpro.app
- **Funding:** Bootstrapped (ürün sahibi doğrulasın)

**What are you building?**
Vekil Pro is a practice-management and AI legal assistant for lawyers in
Turkey. It tracks cases, hearings, statutory deadlines (including
judicial-recess rules) and client finances. Its AI drafts petitions, answers
legal questions and summarizes case law. Every case-law citation it produces
is checked against our own index of Turkish court decisions and against the
official decision search, and citations that cannot be verified are removed
before the lawyer sees them. Petitions can be exported in UDF, the format of
Turkey's national judiciary system (UYAP). The app is live on the App Store
(Türkiye) and on the web.

**How do you use Claude?**
Through the Claude API: Haiku for chat and quick edits, Sonnet for petition
drafting and legal research. Retrieval runs over a corpus of Turkish court
decisions and legislation. Credits would let us test higher-quality model
settings on petition drafting, which lawyers judge most strictly.

## Tarayıcıdaki Claude'a verilecek görev (kopyala-yapıştır)

Claude in Chrome gibi, tarayıcında oturumların açık olduğu bir Claude'a ver:

```
Görev: vekilpro.app alan adında bilgi@vekilpro.app adresini açıp Claude for
Startups başvuru formunu doldur. Sırayla:

1. dash.cloudflare.com → vekilpro.app → Email → Email Routing → etkinleştir.
   Cloudflare'in önerdiği DNS kayıtlarını ekle. Var olan hiçbir DNS kaydını
   SİLME ya da DEĞİŞTİRME (özellikle send.vekilpro.app ve
   resend._domainkey.vekilpro.app: uygulamanın e-postaları bunlarla gidiyor).
   Çakışma uyarısı çıkarsa dur, bana sor.
2. "Destination addresses" bölümüne tarayıcıda açık olan Gmail adresimi ekle.
   Gmail'de Cloudflare'in doğrulama postasını aç, bağlantıya tıkla.
3. "Routing rules" → "Create address": bilgi → aynı Gmail adresi.
4. Gmail'den bilgi@vekilpro.app'e "test" konulu posta gönder. Birkaç dakika
   içinde Gmail'e döndüğünü gör (gelen kutusunda yoksa "Tüm Postalar"a bak).
   Gelmezse dur, bana söyle.
5. https://claude.com/programs/startups → başvur. Claude Console'a benim
   hesabımla gir. Formu aşağıdaki bilgilerle doldur. GÖNDER'E BASMADAN DUR,
   doldurulmuş formu bana göster.

Kurallar: Şifre, API anahtarı ya da ödeme bilgisi isteyen bir adım çıkarsa
dur ve bana sor. Formda burada olmayan bir soru çıkarsa uydurma, bana sor.

Form bilgileri:
Company name: Vekil Pro
Website: https://vekilpro.app
Company email: bilgi@vekilpro.app
Funding: Bootstrapped

What are you building?
Vekil Pro is a practice-management and AI legal assistant for lawyers in
Turkey. It tracks cases, hearings, statutory deadlines (including
judicial-recess rules) and client finances. Its AI drafts petitions, answers
legal questions and summarizes case law. Every case-law citation it produces
is checked against our own index of Turkish court decisions and against the
official decision search, and citations that cannot be verified are removed
before the lawyer sees them. Petitions can be exported in UDF, the format of
Turkey's national judiciary system (UYAP). The app is live on the App Store
(Türkiye) and on the web.

How do you use Claude?
Through the Claude API: Haiku for chat and quick edits, Sonnet for petition
drafting and legal research. Retrieval runs over a corpus of Turkish court
decisions and legislation. Credits would let us test higher-quality model
settings on petition drafting, which lawyers judge most strictly.
```

## Bilinmeyenler

- Başvuru formunun içi görülmedi; alanlar farklı çıkabilir.
- Şirket kurulmamışsa (şahıs) kabul edilip edilmediği sayfada yazmıyor.
- Sonuç ne kadar sürede gelir: bilinmiyor.
