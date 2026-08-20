/**
 * PUANTAJ CETVELİ — ORTAK ÇALIŞMA SUNUCUSU
 * ==========================================
 * Bu kod, bir Google E-Tablosu'nu basit bir ortak depo gibi kullanır.
 * Puantaj uygulaması (index.html) buraya HTTP ile bağlanıp veri okur/yazar.
 *
 * KURULUM
 *   1. Boş bir Google E-Tablosu açın (sheets.new).
 *   2. Üst menü: Uzantılar → Apps Script.
 *   3. Açılan editördeki örnek kodu SİLİN, bu dosyanın tamamını yapıştırın.
 *   4. Yukarıdaki PAROLA sabitini kendi belirlediğiniz bir parola ile değiştirin
 *      (iki bilgisayarda da aynı parolayı gireceksiniz).
 *   5. Kaydet (disket simgesi).
 *   6. Sağ üstte "Dağıt" → "Yeni dağıtım".
 *   7. Dişli simgesine tıklayıp tür olarak "Web uygulaması" seçin.
 *   8. "Yürütme yetkisi": Ben (kendi hesabınız).
 *      "Erişebilenler": Herkes.
 *   9. "Dağıt" deyin, Google izin isteyecek — hesabınızla onaylayın
 *      ("Gelişmiş" → "...'e git (güvenli değil)" uyarısı çıkarsa devam edin,
 *      bu uyarı Google'ın yeni/onaysız scriptler için verdiği standart uyarıdır).
 *  10. Size verilen "Web uygulaması URL'si" ".../exec" ile biter — bu adresi
 *      kopyalayıp puantaj uygulamasında Ayarlar → Ortak Çalışma'ya yapıştırın.
 *
 * Kodu SONRADAN değiştirirseniz: "Dağıt" → "Dağıtımları yönet" → kalem simgesi →
 * "Sürüm: Yeni sürüm" seçip yeniden dağıtın. Adres değişmez.
 */

const PAROLA = "puantaj2026";     // İkisi de aynı parolayı kullanmalı. Boş bırakmayın.
const SAYFA_ADI = "veri";

function _sayfa(){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SAYFA_ADI) || ss.insertSheet(SAYFA_ADI);
}
function _cikti(nesne){
  return ContentService.createTextOutput(JSON.stringify(nesne))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e){
  const parola = (e && e.parameter && e.parameter.parola) || "";
  if (PAROLA && parola !== PAROLA)
    return _cikti({ tamam:false, hata:"parola" });

  const sayfa = _sayfa();
  const surum = Number(sayfa.getRange("B1").getValue()) || 0;
  const veri = sayfa.getRange("A1").getValue() || "";
  return _cikti({ tamam:true, surum:surum, veri:veri });
}

function doPost(e){
  const kilit = LockService.getScriptLock();
  kilit.waitLock(15000);
  try {
    let govde;
    try { govde = JSON.parse(e.postData.contents); }
    catch (hata) { return _cikti({ tamam:false, hata:"gecersiz_istek" }); }

    if (PAROLA && govde.parola !== PAROLA)
      return _cikti({ tamam:false, hata:"parola" });

    const sayfa = _sayfa();
    const mevcutSurum = Number(sayfa.getRange("B1").getValue()) || 0;
    const beklenen = Number(govde.beklenenSurum);

    /* beklenenSurum -1 ise "zorla yaz" (çakışma ekranında kullanıcı bilerek seçti) */
    if (beklenen !== -1 && beklenen !== mevcutSurum){
      return _cikti({
        tamam:false, hata:"cakisma",
        surum:mevcutSurum, veri:sayfa.getRange("A1").getValue() || ""
      });
    }

    const yeniSurum = mevcutSurum + 1;
    sayfa.getRange("A1").setValue(JSON.stringify(govde.veri));
    sayfa.getRange("B1").setValue(yeniSurum);
    sayfa.getRange("C1").setValue(new Date());
    return _cikti({ tamam:true, surum:yeniSurum });
  } finally {
    kilit.releaseLock();
  }
}
