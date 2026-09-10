/**
 * CSV METNİ ÜRETİMİ — react-native'e BAĞIMSIZ tutulur.
 *
 * NEDEN AYRI DOSYA. Bu mantık exportCsv.ts içindeydi ve o dosya `Share` ile
 * `expo-file-system` çekiyor. Test koşucusu react-native'in Flow sözdizimini
 * ayrıştıramadığı için dosyanın TAMAMI test edilemiyordu — kritik bir kusur
 * (muhasebeciye giden dosyayı üreten kod) hiç sınanmadan duruyordu. Saf kısmı
 * ayırmak, env.ts'de aynı sebeple uygulanan kalıbın aynısıdır.
 */

/**
 * Bir hücreyi CSV için güvenli hale getirir.
 *
 * İKİ AYRI KUSUR BURADA DÜZELTİLDİ:
 *
 * 1) SAYILAR TÜRKÇE EXCEL'DE METİN OLARAK AÇILIYORDU. Dosya bilinçli olarak
 *    noktalı virgülle ayrılıyor (çünkü Türkçe Excel'de ondalık ayırıcı
 *    virgüldür) ama tutarlar `toFixed(2)` ile "1234.56" diye NOKTALI
 *    yazılıyordu. Türkçe Excel bunu sayı değil METİN sayar: muhasebeci sütunu
 *    toplayamaz. Dışa aktarmanın tek amacı o toplamı almak olduğu için bu,
 *    özelliği sessizce işe yaramaz kılıyordu.
 *
 * 2) FORMÜL ENJEKSİYONU. '=', '+', '@' ya da tab ile başlayan bir hücreyi
 *    Excel FORMÜL olarak yorumlar. Başlık ve not alanları kullanıcıdan geliyor
 *    ve bu dosya muhasebeciye gönderiliyor; yani başkasının bilgisayarında
 *    çalışan içerik üretilebilirdi (CWE-1236). NEGATİF SAYILAR BİLİNÇLİ OLARAK
 *    MUAF: "-1234,56" tırnaklansaydı gider satırları metne dönerdi — yani
 *    1. kusuru geri getirirdi.
 */
function cell(v: string | number | null | undefined): string {
  if (typeof v === 'number' && Number.isFinite(v)) {
    // Binlik ayırıcı KOYULMAZ: "1.234,56" ayrıştırmayı bölgeye göre yine
    // kırılgan yapar.
    return v.toFixed(2).replace('.', ',');
  }
  let s = v == null ? '' : String(v);
  if (/^[=+@\t\r]/.test(s) || (s.startsWith('-') && !/^-?\d+([.,]\d+)?$/.test(s))) {
    s = `'${s}`;
  }
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Satırlardan CSV metni üretir.
 * Ayırıcı NOKTALI VİRGÜL: Türkçe Excel'de ondalık ayırıcı virgül olduğu için
 * virgüllü CSV sütunlara doğru bölünmez.
 */
export function toCsv(header: string[], rows: Array<Array<string | number | null | undefined>>): string {
  const lines = [header.map(cell).join(';'), ...rows.map((r) => r.map(cell).join(';'))];
  // BOM: Excel'in UTF-8'i (Türkçe karakterler) doğru okuması için gerekli.
  return '﻿' + lines.join('\r\n');
}
