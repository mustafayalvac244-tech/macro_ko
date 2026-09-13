# ilac-karekod

Türk ilaç kutusundaki **GS1 DataMatrix** karekodunu ayrıştıran, bağımlılığı
olmayan tek dosyalık TypeScript modülü. `ILAC-KAREKOD.md` notundaki teknik
bölümün çalışan ve test edilmiş hâli.

**Bu klasör VekilPro uygulamasının parçası değil.** Kök `tsconfig.json`'da
`exclude` listesine eklendi ki `npm run kontrol` bundan etkilenmesin. Kendi
`tsconfig.json`'u ve kendi testi var; olduğu gibi başka bir projeye kopyalanabilir.

## Çalıştırma

```bash
node --experimental-strip-types --test ilac-karekod/karekod.test.ts   # 27 test
npx tsc -p ilac-karekod                                              # tip denetimi
```

Vitest'e taşımak için `karekod.test.ts`'in ilk iki import satırını
`import { describe, it, expect } from 'vitest';` ile değiştirip `assert`
çağrılarını `expect`'e çevirmek yeterli.

## Ölçüm kaydı — ne doğrulandı, ne doğrulanmadı

**Doğrulandı** (bu depoda, tekrar koşulursa aynı çıkar):

- 27 testin 27'si geçiyor.
- `tsc --strict --noUncheckedIndexedAccess` temiz.
- Kontrol hanesi hesabı, bilinen bir EAN-13 (`4006381333931`) ile sınandı.

**Doğrulanmadı:**

- **Modül tek bir gerçek ilaç kutusunda denenmedi.** Testlerdeki karekodlar
  elle yazıldı; sınav setini de "doğru"nun tanımını da ben yazdım. Bu ölçüm
  değerlidir ama tek başına yeterli değildir — birkaç gerçek kutuyu okutup
  çıktıyı kutunun üstündeki yazıyla karşılaştırman gerekir.
- Alan sırası ve olası ek AI'lar TİTCK karekod kılavuzundan teyit edilmedi.
- `GTIN = 08680000000013` **uydurmadır**, gerçek bir ürün değildir; yalnız
  kontrol hanesi doğru olacak şekilde hesaplanmıştır.

## Testleri yazarken çıkan iki gerçek hata

1. **`ILAC-KAREKOD.md`'deki örnek GTIN geçersizdi.** `08680000000017`'nin
   kontrol hanesi tutmuyor; doğrusu `...013`. Kontrol hanesi doğrulaması tam da
   bunun için var: hatalı okumayı sessizce kabul etmek yerine reddediyor.
2. **Eksik yol: kutunun çizgili barkodu.** AI `(01)` standartta zaten 14 hane
   sabit, yani 13 haneli GTIN karekoddan hiç gelmez — kutunun üstündeki eski
   **EAN-13** barkodundan gelir ve onda hiç AI yoktur. Bu yol modülde yoktu;
   eklendi. Önemli farkı modül açıkça bildiriyor: EAN-13 **kutuyu değil yalnız
   ürünü** tanır, seri numarası ve son kullanma tarihi taşımaz — yani o kodla
   Miat Radarı da mükerrer sayım engeli de çalışmaz.

## Notun ilk hâlindeki ayrıştırıcıya göre farklar

| Konu | İlk hâli | Şimdi |
|------|----------|-------|
| Tanınmayan AI | Sessizce sonuna kadar yutuyordu | `kalan` olarak raporlanıyor, GTIN korunuyor |
| Hatalı okuma | Fark edilmiyordu | GTIN kontrol hanesi doğrulanıyor |
| Sıradan bir QR | `{gtin: undefined}` dönüyordu | `gecerli: false, sebep: 'gs1-degil'` |
| Eksik alan | `undefined` | `eksik: ['seri', 'parti']` — açık liste |
| 30 Şubat gibi tarih | Sessizce 2 Mart'a kayıyordu | `null` |
| 3-4 haneli AI | Yanlış ayrıştırıyordu | Tanınıyor |
| Çizgili barkod | Hiç yoktu | Destekleniyor, sınırı bildiriliyor |

## Kullanım

```ts
import { karekoduAyristir, kalanGun } from './karekod.ts';

const sonuc = karekoduAyristir(okunanMetin);

if (!sonuc.gecerli) {
  // sebep: 'bos' | 'gs1-degil' | 'gtin-yok' | 'gtin-bicim' | 'gtin-kontrol-hanesi'
  return kullaniciyaGoster(sonuc.ayrinti);
}

// Miat Radarı: kutu bazında, çünkü seri numarası her kutuda farklı.
if (sonuc.skt && kalanGun(sonuc.skt) < 90) {
  miadiYaklasanlar.set(sonuc.seri ?? sonuc.gtin, sonuc);
}
```
