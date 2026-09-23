# KVKK uyumu — nerede duruyoruz

> **23.09.2026.** Ürün sahibi: *"KVKK'yi sen yap, ne gerekiyorsa kendimizi
> güvene al."*
>
> **Kaynak ayrımı:** **ÖLÇÜLDÜ** = bugün kodda / canlı veritabanında bakıldı.
> Hukuki dayanaklar bilgi kesimim itibarıyladır ve **bir yapay zekâ
> değerlendirmesidir, avukat kontrolünden geçmedi.** Müşterimiz avukat;
> yayından önce bir avukatın bu belgeyi okuması en ucuz sigortadır.

---

## 1. Bugün yapılanlar

| İş | Durum |
|---|---|
| Kullanım Koşulları **m.18 — veri işleyen taahhüdü** (TR, EN, web) | ✅ yazıldı (`5e7d13b`) |
| Servis anahtarını okuyan işlevlerin dışarıya kapatılması | ✅ canlıda uygulandı + doğrulandı (`0155`) |
| Veri ihlali prosedürü (`VERI-IHLALI.md`) | ✅ yazıldı |
| Giriş ekranında ham sunucu çıktısı (adres dâhil) sızması | ✅ kodda düzeltildi (`3a03fa4`), yeni derlemeyle gider |

## 2. Zaten sağlam olan — ÖLÇÜLDÜ

- Aydınlatma metni (TR + EN): amaçlar, hukuki sebepler, alıcı listesi
  (koddan okunmuş), m.11 hakları, **sorumlu/işleyen ayrımı**, özel nitelikli
  veri uyarısı, Av.K. m.36 sır saklama saklı tutulmuş.
- Yapay zekâ için **ayrı ve geri alınabilir açık rıza**; rıza yoksa yapay
  zekâya hiçbir şey gitmiyor.
- Hesap silme uygulama içinden, anında; yedeklerden silinme süresi yazılı.
- Kullanıcı verileri satır düzeyinde (RLS) hesaba kilitli.
- Yönetici işlevlerinin altısında da `is_admin` kontrolü var (gövdeler okundu).

---

## 3. AÇIK — senden bilgi gerekiyor

### 3.1 Veri sorumlusunun kimliği — **yayın engeli**

`src/config/kvkk.ts` → `VERI_SORUMLUSU`: `unvan`, `adres`, `eposta` üçü de
`null` (ÖLÇÜLDÜ). Aydınlatma metni bu yüzden kendi eksikliğini kullanıcıya
söylüyor: *"BU ALAN HENÜZ DOLDURULMAMIŞTIR."*

KVKK m.10'un ilk bendi: **veri sorumlusunun kimliği.** Bunu ben dolduramam;
uydurursam yasal bir metne yanlış beyan yazmış olurum.

**Gönder, 5 dakikada girerim:**
1. **Unvan** — şirket varsa ticaret unvanı; yoksa şahıs adı-soyadı.
   *(Uygulamanın alt satırında "VEKİL Yazılım" yazıyor. Tescilli bir unvan
   değilse aydınlatma metninde KULLANILMAMALI.)*
2. **Adres** — tebligata elverişli açık adres.
3. **Başvuru e-postası** — KVKK başvurularının geleceği, **okunan** bir adres.
4. Varsa: KEP, MERSİS no.

---

## 4. AÇIK — bilerek alınan ya da karar bekleyen riskler

### 4.1 Yurt dışına aktarım — **en büyük hukuki risk**

**Durum (ÖLÇÜLDÜ):** bütün hesap, dava, müvekkil ve belge kayıtları
Supabase'in **İrlanda** bölgesinde (eu-west-1). Yapay zekâ istekleri ABD'deki
sağlayıcılara gidiyor.

**Hukuk değişti.** 7499 sayılı Kanun (RG 12.03.2024) KVKK m.9'u yeniden
yazdı; 01.06.2024'te yürürlüğe girdi. Yeni düzende yurt dışına aktarım şu
sırayla mümkün:
1. Kurul'un **yeterlilik kararı** olan ülkeye — *bilgi kesimim itibarıyla
   Kurul yeterlilik kararı yayımlamadı; kontrol edilmeli.*
2. **Uygun güvenceler** — en pratiği Kurul'un ilan ettiği **standart
   sözleşme**: taraflarca imzalanır ve imzadan itibaren **5 iş günü içinde
   Kurum'a bildirilir.** Bildirmemenin idari para cezası var.
3. Bunlar yoksa yalnız **arızi** (düzenli olmayan) aktarımlar için istisnalar
   — açık rıza bunlardan biri.

**Bize bakan yüzü:**
- **Supabase aktarımı** için aydınlatma metninde **bir dayanak yazmıyor.**
  Düzenli ve sistematik bir aktarım; açık rızaya da dayanamaz (arızi değil).
- **Yapay zekâ aktarımı** açık rızaya dayandırılmış. Her istek kullanıcının
  kendi eylemiyle başlıyor, ama hizmetin kendisi düzenli olarak bu aktarımı
  yapıyor — "arızi" sayılıp sayılmayacağı **tartışmalı.**

Metne sahip olmadığımız bir dayanağı yazmadım; yazsaydım yanlış beyan olurdu.

**Seçenekler — kararı senin:**

| | Ne | Zorluk |
|---|---|---|
| **A** | Supabase ve yapay zekâ sağlayıcılarıyla **KVKK standart sözleşmesi** imzala, 5 iş günü içinde Kurum'a bildir | Yabancı sağlayıcıların Türk şablonunu imzalayıp imzalamayacağı **bilinmiyor** — sormak gerek |
| **B** | Veriyi **Türkiye'de** barındır | büyük göç; Supabase'in Türkiye bölgesi yok |
| **C** | Bugünkü hâlde kal, riski bilerek al | en ucuzu; avukat müşteriler bunu sorabilir |

**Önerim: A'dan başla** — Supabase desteğine KVKK standart sözleşmesini
imzalayıp imzalamadıklarını sor. Cevap gelmeden B'ye yatırım yapma.

**Neden satışla da ilgili:** müşterimiz avukat ve müvekkil sırrını
taşıyor. "Verim nerede, hangi dayanakla" sorusu gelecek. Cevabı yazılı olan
kazanır.

### 4.2 VERBİS

Veri sorumlusu olarak işlediğimiz veri avukatların **kendi hesap bilgileri**;
özel nitelikli veri işlemek ana faaliyetimiz değil. Müvekkil dosyalarında
veri işleyeniz ve VERBİS kaydı veri sorumlusunun yükümlülüğü.

Bu yüzden **muhtemelen muafız** — çalışan sayısı ve bilanço eşikleri Kurul
kararıyla belirlenir ve değişti; güncel eşik **kontrol edilmedi.**
Aydınlatma metni bugün *"kayıt yükümlülüğü değerlendirilmektedir"* diyor;
doğru ifade budur, değiştirilmedi.

### 4.3 Sızmış şifre koruması kapalı — ÖLÇÜLDÜ

Supabase güvenlik denetimi: *Leaked Password Protection Disabled.* Açıkken
kullanıcı, bilinen bir veri sızıntısında geçen şifreyi seçemiyor.
Supabase Dashboard → Authentication → Password security. Planımızda açılıp
açılamadığı **kontrol edilmedi.**

### 4.4 Eczane uygulamasının açıkları — dokunulmadı

Aynı denetim `aile_*`, `ilac_sayac_*` işlevlerini ve `ilac_detay`
görünümünü de işaretledi. Bunlar **başka bir ürünün** (AGENTS.md: eczane
tabloları); dokunmak o uygulamayı kırabilir. İlaç Pro oturumuna iletilmeli.
