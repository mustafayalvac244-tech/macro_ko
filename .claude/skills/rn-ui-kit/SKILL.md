---
name: rn-ui-kit
description: Vekil Pro'nun React Native / Expo arayüz standartları — tasarım token'ları, bileşen yapısı, stil yaklaşımı, navigasyon ve erişilebilirlik kuralları. Kullanıcı ekran, bileşen, layout, stil, tema, navigasyon veya "şu ekranı yap / şuraya buton ekle / bunu düzelt" türünde herhangi bir arayüz işi istediğinde MUTLAKA bu skill'i kullan — kullanıcı "tasarım sistemi" veya "skill" kelimesini hiç söylemese bile. Yeni ekran oluştururken, mevcut ekranı düzenlerken ve UI kodu review ederken de geçerlidir.
---

# Vekil Pro — RN UI Kit

Arayüz yazarken bu kurallara uy. Kural burada yoksa mevcut koddaki en yakın
örneği taklit et; yeni kalıp icat etme.

> **BU DOSYA ÖLÇÜLEREK YAZILDI (14.09.2026).** Aşağıdaki her sayı depodan
> sayıldı, tahmin edilmedi. Şablondan gelen ama BU PROJEDE GEÇERLİ OLMAYAN
> kurallar (expo-image, reanimated, "150 satırı geçme", ham SafeAreaView)
> silindi — doğru olmayan bir kural, kural olmamasından kötüdür: otorite
> kazanır ve sonraki oturumları yanlış yere götürür.
>
> Bölüm 6'da "HENÜZ UYULMUYOR" diye işaretli bir madde var. Orası bilerek
> böyle: hedefi kural gibi yazıp gerçekmiş gibi göstermiyoruz.

---

## 1. Tasarım token'ları

Kaynak: `src/theme/tokens.ts` (ölçü) + `src/theme/palettes.ts` (renk).

```
Boşluk (spacing)   xxs 4 · xs 8 · sm 12 · md 16 · lg 20 · xl 24 · xxl 32 · xxxl 40
Köşe (radius)      sm 8 · md 12 · lg 16 · xl 20 · pill 999
Font ailesi        Manrope (regular 400 · medium 500 · semibold 600 · bold 700 · extrabold 800)
                   DancingScript_700Bold — YALNIZ marka yazısı için

Tipografi (fontSize)
  display 30 · h1 24 · h2 20 · h3 17 · body 15 · bodyMedium 15 · caption 13 · small 11
  ayrıca: card · floating
```

**`typography.*` bir STİL NESNESİDİR, sayı değil.** `fontSize: typography.sm`
gibi bir kullanım tip hatası verir — üstelik `sm` diye bir tipografi anahtarı
da yok (o boşluk skalasında). Doğrusu yayma:

```tsx
baslik: { ...typography.h3, color: colors.textPrimary }
```

### Renk — 5 TEMA VAR

`light · dark · sepia · emerald · obsidian`. Bu yüzden **çıplak hex yazmak 2
değil 5 temada birden bozulur.** Renk her zaman `useTheme()` üzerinden gelir:

```tsx
const __t = useTheme();
const colors = __t.colors;
const styles = makeStyles(__t.colors);   // stiller temadan türetilir
```

Token adları (`ThemeColors`, `src/theme/palettes.ts`):

```
Yüzey    bg · bgElevated · surface · surfaceHover · surfaceAlt
Çizgi    border · borderSubtle
Yazı     textPrimary · textSecondary · textMuted · textInverse
Vurgu    primary · primaryMuted · primarySoft · gold · goldSoft
Durum    success/successSoft · warning/warningSoft · danger/dangerSoft · info/infoSoft
Diğer    overlay · transparent
```

**`colors.text` DİYE BİR TOKEN YOK** — `colors.textPrimary`. (Bu hata
14.09.2026'da gerçekten yapıldı ve derlemede yakalandı.)

Kurallar:
- Boşluk ve köşe için **skala dışı değer kullanma**. `padding: 14` yerine 12
  veya 16. İstisna: 1–6 px'lik optik hizalama düzeltmeleri (`marginTop: 2`)
  — bunlar skalaya girmez, zaten kodda da öyle.
- **Renkli zemin üstündeki yazı/ikon `colors.textInverse` kullanır**, çıplak
  `'#FFFFFF'` değil.
  > Ölçüm: depoda tema dosyaları dışında **84 sabit hex** var, **64'ü
  > `#FFFFFF`** ve `textInverse` zaten tam olarak `#FFFFFF`. Bugün çalışıyorlar,
  > bozuk değiller — bu yüzden **toplu değiştirilmediler** (64 yeri elle
  > değiştirmenin kullanıcıya görünen faydası yok, regresyon riski var).
  > Kural YENİ kod için geçerli. Mevcutlar bilinen borç.
- Gölge yerine `border` + yüzey rengi farkı; iOS/Android gölgesi tutarsız.

---

## 2. Stil yaklaşımı — `StyleSheet.create`

Ölçüm: **104 dosya `StyleSheet.create`, 0 dosya NativeWind/`className`.**

- Tema bağımlı stiller dosya sonunda `makeStyles(colors: ThemeColors)`
  fabrikasıyla üretilir — sabit `StyleSheet.create` tema değişince donar.
- Inline `style={{ }}` yalnız gerçekten dinamik değer için (ölçülen yükseklik,
  animasyon, koşullu tek bir renk). Statik stil asla inline değil.
- Koşullu stil dizi ile: `style={[styles.satir, secili && styles.satirSecili]}`

---

## 3. Bileşen ve dosya yapısı

- Ekranlar `app/` altında (expo-router, dosya = rota). **64 ekran.**
- Paylaşılan arayüz bileşenleri **`src/components/ui/`** altında — `components/`
  değil. Bugün **24 bileşen** var; yeni bir şey yazmadan önce buraya bak:

  `Screen · ScreenHeader · Card · Button · Input · Badge · StatusBadge ·
  EmptyState · SegmentedControl · SearchBar · SectionHeader · StatCard ·
  Avatar · FAB · SuggestInput · ThemePicker · TemaDugmesi · VekilLogo ·
  WebKart · HukukiUyari · AtifDenetimi · CiktiEylemleri ·
  DuzenlenebilirCikti · UyariKatmani`

- Props için TypeScript tipi yaz, `any` kullanma.
- Dosya sırası: importlar → tipler → bileşen → `makeStyles` (en altta).

> Şablondaki **"150 satırı geçen bileşeni böl"** kuralı SİLİNDİ: 120 `.tsx`
> dosyasının **67'si** 150 satırı geçiyor. Uymadığımız bir kuralı yazmak,
> sonraki oturumu çalışan ekranları bölmeye iter.

### Platforma özel ekran (yalnız web / yalnız native)

Expo Router (SDK 57) dokümanı: `app/` içinde platform uzantısı **ancak
platformsuz sürüm de varsa** çalışır — rotalar derin bağlantı için evrensel
kalır. Yani `app/x.web.tsx` tek başına rotayı native'de gizlemez.

Doğru kalıp — bölmeyi `app/` DIŞINDA yap:

```
src/components/tevkil/Pano.web.tsx   → gerçek ekran (yalnız web paketine girer)
src/components/tevkil/Pano.tsx       → "yalnız web" notu (native paketine girer)
app/tevkil.tsx                       → export { default } from '@/components/tevkil/Pano'
```

Böylece rota evrensel kalır ama kod native pakete hiç girmez. Gerekçe ve
Play içerik anketi bağlantısı: `src/components/tevkil/YalnizWeb.tsx`.

---

## 4. Her ekranda zorunlu

- **`<Screen edges={[...]}>` kullan**, ham `SafeAreaView` değil.
  Ölçüm: 60 ekran `Screen`, 1 dosya doğrudan `SafeAreaView`.
- Başlık için `<ScreenHeader title subtitle showBack rightIcon onRightPress />`.
- Klavye açılan ekranda `KeyboardAvoidingView`
  (`behavior={Platform.OS === 'ios' ? 'padding' : undefined}` — koddaki kalıp).
- Uzun liste `FlatList`; kısa ve sabit liste `.map()` ile olabilir.
- **Üç durumu da ele al: yükleniyor · boş · hata.** Boş durum için
  `EmptyState` (17 dosyada kullanılıyor), hata için kırmızı `errorBox` kalıbı.
- Dokunulabilir alan en az 44×44. Küçük ikona `hitSlop` ver (32 dosyada var).
- Uyarı/onay için `uyar()` (`@/lib/uyari`) — ham `Alert` değil; web'de de çalışır.

---

## 5. Metin ve dil

- **Ekrana yazdığın hiçbir metni doğrudan yazma**, `useT()` ile i18n'den al.
  Her anahtarın `src/i18n/tr.ts` VE `src/i18n/en.ts` karşılığı olmalı.
- **Yeni özellik yeni ad alanı alır.** Ölçülmüş hata: toplu aktarım anahtarları
  `imp.` altına yazıldı ve `dosya-aktar` ekranınınkilerle çakıştı; `toplu.`
  ad alanına taşınarak çözüldü. Tevkil de bu yüzden `tevkil.` altında.
- Türkçe büyük/küçük harf tuzağı: CSS `text-transform: uppercase` ve
  `toLocaleUpperCase()` "i" → "I" yapar, "İ" değil. Başlığı büyük harf
  göstermen gerekiyorsa metni i18n'de zaten büyük yaz.

---

## 6. Erişilebilirlik

- Bilgiyi **yalnız renkle aktarma**; ikon veya metin de ekle. (Kodda uyuluyor:
  atıf denetimi ve durum rozetleri hem renk hem ikon/metin taşıyor.)
- Kullanıcının sistem yazı boyutunu ezme — `allowFontScaling={false}` yazma.
- Metin kontrastı en az 4.5:1.

> **HENÜZ UYULMUYOR — `accessibilityLabel`.** Ölçüm: dokunulabilir öğe içeren
> **70 dosyanın yalnız 6'sında** `accessibilityLabel` var. Yani bu bir kural
> değil, **hedef**. Dürüst duruş: *yeni* yazdığın dokunulabilir öğelere ekle;
> ama "projede erişilebilirlik var" diye rapor etme — yok. Geriye dönük
> tamamlanması ayrı ve ölçülmemiş bir iş.

---

## 7. Kullanılmayan kütüphaneler — kurmaya kalkma

Ölçüm (`app/` + `src/`, `.tsx`):

| Kütüphane | Kullanan dosya |
|---|---|
| `expo-image` | **0** |
| `react-native-reanimated` | **0** |
| NativeWind | **0** |
| RN yerleşik `Animated` | 2 |
| `expo-haptics` | 2 (yalnız `Button` ve `FAB` içinde) |

Görsel için RN `Image`, animasyon için yerleşik `Animated` yeterli oldu.
Bir arayüz işi için yeni bağımlılık eklemeden önce **sor** — yeni native
bağımlılık, OTA ile gidemeyecek bir derleme (~35 dk) demektir.

---

## 8. Çıktı formatı

Bir ekran istendiğinde:
1. Kısa layout planı (hangi bölüm, hangi sırada).
2. Kod.
3. Sonunda **varsayımlarını maddele** — uydurduğun metin, ikon veya davranış
   varsa açıkça söyle.

Elinde olmayan veri için sahte içerik üretip gerçekmiş gibi sunma; `TODO` ile
işaretle. (Proje genelindeki dürüstlük kuralları `AGENTS.md`'de ve burada da
geçerli.)
