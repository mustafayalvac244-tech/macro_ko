// KURAL EŞLEŞMESİ ÖLÇÜMÜ — model çağrısı yok, kotadan bir şey götürmez.
// ---------------------------------------------------------------------------
// NEDEN VAR. Kurallar modele "KESİN HUKUKİ KURAL — bunlara uymak zorundasın"
// diye besleniyor. Yanlış kural gelirse model onu doğru sanıp uygular; kural
// hiç gelmezse ölçümle kazanılmış bütün düzeltmeler yok sayılır.
//
// ÖLÇÜLEN İKİ ARIZA:
//   • "Performans gerekçesiyle çıkarıldı, savunması alınmamış" (işe iade)
//     sorusunda ise_iade kuralı HİÇ gelmiyor, yerine KİRA sözleşmesinin on
//     yıllık uzama kuralı besleniyordu. Üretilen mütalaada arabuluculuktan söz
//     edilmedi — oysa işe iadede arabuluculuk DAVA ŞARTIDIR ve doğrudan dava
//     açan avukat davasını usulden kaybeder.
//   • "İdari para cezasına iptal davası" sorusunda HAGB (ceza hukuku) kuralı
//     birinci sırada geliyordu; idari dava süresini anlatan kural havuzda hiç
//     yoktu.
//
// KÖK SEBEP: tetikleyiciler hukuk terimleriyle yazılmıştı. Avukat müvekkilin
// anlattığını yazıyor ("çıkarıldı", "işten attılar"), kuralın beklediği
// kelimeleri değil. Terimi bilen zaten kuralı da biliyor; yardıma en çok
// ihtiyacı olan anlatım tam da bulunamayan anlatımdı.
//
// Betik hem düzeltmeyi doğrulamak hem de yeni kural eklerken SIZINTIYI görmek
// için: eklediğin kural başka alanların sorularına karışıyor mu? (idari kural
// ilk yazımda bilirkişi sorusuna sızdı, tetikleyicisi daraltıldı.)
//
// Kullanım: SVC=<service_role> node scripts/kural-eslesme.mjs
const H={apikey:svc,Authorization:'Bearer '+svc,'Content-Type':'application/json'};
const sorular = [
 ['işten çıkarma','Müvekkil performans düşüklüğü gerekçesiyle çıkarıldı, savunması alınmamış.'],
 ['trafik kazası','Trafik kazasında yaralandı, karşı sürücü alkollüydü, tazminat isteyeceğiz.'],
 ['ödeme emri','Bonoya dayalı kambiyo takibi, ödeme emri tebliğ edildi, imza müvekkile ait değil.'],
 ['boşanma','Şiddetli geçimsizlik var, boşanma davası açacağız, velayet talep edeceğiz.'],
 ['kira tahliye','Kiracı iki aydır kira ödemiyor, tahliye istiyoruz.'],
 ['idari ceza','İdari para cezasına iptal davası açacağız, adli tatile denk geliyor.'],
 ['bilirkişi','Bilirkişi raporu eksik inceleme yapmış, itiraz edeceğiz.'],
 ['miras','Muris muvazaası var, tapu iptali ve tescil davası düşünüyoruz.'],
];
const esikler = [0, 0.12, 0.15, 0.20];
for (const [ad,q] of sorular) {
  const r = await fetch(`${url}/rest/v1/rpc/search_legal_rules`,{method:'POST',headers:H,body:JSON.stringify({q, match_count:3})});
  const d = await r.json();
  const top = Number(d[0]?.score ?? 0);
  const satir = esikler.map(e => {
    const kalan = d.filter(x => Number(x.score) >= Math.max(e, top*0.45));
    return `${e.toFixed(2)}:${kalan.length}`;
  }).join(' ');
  console.log(`${ad.padEnd(15)} ${satir}  |  ${d.map(x=>`${x.id}(${Number(x.score).toFixed(3)})`).join(', ')}`);
}
