# Model karşılaştırması — itibara göre değil, ölçerek seç

Hangi modelin daha iyi dilekçe yazdığı tahminle seçilmemeli. Aynı senaryolar
her aday modelle koşturulur, sonuçlar aynı ölçütlerle karşılaştırılır.

## Hazırlık (bir kez)

```bash
# Anahtar(lar)
npx supabase secrets set ANTHROPIC_API_KEY=... --project-ref <ref>
```

## Bir adayı ölçmek

```bash
REF=wjshlysfmeqlnfiibknj

# 1) Adayı zorla (üretimde bu anahtarlar TANIMLI DEĞİLDİR)
npx supabase secrets set VEKIL_ZORLA_SAGLAYICI=claude VEKIL_ZORLA_MODEL=claude-sonnet-5 --project-ref $REF

# 2) Üç ölçümü de koştur
export SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=...
node scripts/eval-dilekce.mjs   | tee /tmp/sonuc-sonnet-dilekce.txt
node scripts/eval-cevap.mjs     | tee /tmp/sonuc-sonnet-cevap.txt
EVAL_HIBRIT=1 node scripts/eval-arama.mjs   # arama modelden bağımsız; taban çizgisi

# 3) Sonraki aday
npx supabase secrets set VEKIL_ZORLA_MODEL=claude-opus-5 --project-ref $REF
node scripts/eval-dilekce.mjs   | tee /tmp/sonuc-opus-dilekce.txt

# 4) BİTİNCE ZORLAMAYI KALDIR — yoksa tüm kullanıcılar o modele gider
npx supabase secrets unset VEKIL_ZORLA_SAGLAYICI VEKIL_ZORLA_MODEL --project-ref $REF
```

## Neye bakılacak

`eval-dilekce` üç sayı verir; sıralama önem sırasına göredir:

1. **Uydurma veri içeren taslak** — sıfır olmalı. Bir modelin diğerinden
   "daha akıcı" yazması, uydurma tarih üretmesini telafi etmez.
2. **Eksik zorunlu unsur** — usul kanununun aradığı içerik (HMK m.119 dava
   değeri, netice-i talep…). Eksikse mahkeme dilekçe ihtarı gönderir.
3. **Tam geçen senaryo sayısı**.

Ayrıca `scripts/eval-dilekce-hatalar.json` kusurlu taslakların TAM METNİNİ
saklar; sayılar eşitse metinler okunup karar verilir.

## Dikkat

- **Ölçüm sırasında maliyet işler.** Zorlanan model ücretliyse `ai_usage`
  tablosuna yazılır ve katman tavanı çalışmaya devam eder.
- **Fiyat tablosuna eklenmemiş model, EN PAHALI fiyatla sayılır** (bilerek:
  az saymak parayı fatura gelince gösterir). Yeni bir model kalıcı olacaksa
  `PRICING` tablosuna gerçek fiyatını ekleyin.
- Ücretsiz katmanlarda ölçümün kendisi günlük kotayı bitirebiliyor; koşular
  arasına `EVAL_BEKLEME` ile boşluk bırakın.
