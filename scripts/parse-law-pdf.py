#!/usr/bin/env python3
"""Resmî mevzuat.gov.tr PDF'inden kanun maddelerini src/data/laws/*.json biçimine çıkarır.

Kullanım:
    python3 scripts/parse-law-pdf.py <kanun_no> <slug> <kısaltma> "<tam ad>"
    python3 scripts/parse-law-pdf.py 2577 iyuk İYUK "2577 sayılı İdari Yargılama Usulü Kanunu"

Gerekli: pymupdf.

NEDEN BU BETİK VAR. Havuzdaki en çok atıf alan maddelerin METNİ YOKTU: İYUK
m.49'a 586 karar, m.50'ye 169, İİK m.72'ye 70 karar atıf yapıyor ama iki kanunun
da metni havuzda değildi. Atıf haritası (0044-0046) bu boşluğu tahmin olmaktan
çıkarıp SAYIYA çevirdi; bu betik boşluğu kapatmak için yazıldı.

DİPNOTLAR YAZI BOYUYLA AYIKLANIR. Resmî PDF'lerde gövde 12 punto, sayfa altı
dipnotları 10 punto, satır içi dipnot işaretleri ("...veremezler.3") 6,5-8
puntodur. Metinsel ayıklama (ör. "satır rakamla başlıyorsa dipnottur") burada
YANLIŞ olurdu: kanun fıkraları da "1. ", "2. " diye başlar. Punto eşiği ikisini
şaşmadan ayırır ve satır içi üstsimge rakamlarını da temizler — aksi hâlde
madde metnine "veremezler3" gibi bozuk kelimeler sızardı.
"""
import json, os, re, ssl, sys, urllib.request

import pymupdf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LAWS = os.path.join(ROOT, 'src', 'data', 'laws')
CA = os.environ.get('LAW_CA_BUNDLE', '/root/.ccr/ca-bundle.crt')

GOVDE_PUNTO = 11.5

# "Madde 5 –", "MADDE 5-", "Ek Madde 1 –", "Geçici Madde 12 –" ve HARFLİ ALT
# MADDELER: "Madde 8/a –", "MADDE 183/A-", "Madde 20/B –".
#
# Harfli alt madde AYRI BİR MADDEDİR ve sık atıf alır (İİK m.169/a itirazın
# kaldırılması, m.150/ı, İYUK m.20/A ivedi yargılama). Desene alınmadıkları
# için 93'ü İİK'da olmak üzere 98 madde, bir ÖNCEKİ maddenin gövdesine
# karışıyordu: yani hem kendileri kayıp, hem de karıştıkları maddenin metni
# yanlış görünüyordu.
MADDE = re.compile(
    r'^((?:Ek|EK|Geçici|GEÇİCİ)\s+)?(?:Madde|MADDE)\s+'
    r'(\d+(?:\s*/\s*[A-Za-zÇĞİÖŞÜçğıöşü])?)\s*[-–—]\s*(.*)$')
# Satır sonunda "Madde" kalıp numarası alt satıra düşmüş olabilir.
MADDE_ASKIDA = re.compile(r'^((?:Ek|EK|Geçici|GEÇİCİ)\s+)?(?:Madde|MADDE)$')
# Madde numarası öneki tek biçime indirilir.
#
# NE upper() NE title() TÜRKÇE'DE GÜVENİLİR — ikisi de bu betikte hataya yol
# açtı: title() 'GEÇİCİ' → 'Geçi̇ci̇' (birleşen nokta), upper() 'Geçici' →
# 'GEÇICI' (noktasız I). İkincisi 11 geçici maddeyi numarasız bırakıp sayısal
# maddeyle çakıştırarak SESSİZCE SİLDİRDİ. Bu yüzden karşılaştırmadan önce
# ASCII'ye indiriyoruz. (Aynı tuzağın SQL'deki hâli: 0045.)
TR_ASCII = str.maketrans('İIıŞşĞğÜüÖöÇçÂâÎîÛû', 'IIiSsGgUuOoCcAaIiUu')
ONEK_ADI = {'EK': 'Ek', 'GECICI': 'Geçici', '': ''}
# "BİRİNCİ BÖLÜM" / "İKİNCİ BAP" / "ÜÇÜNCÜ KISIM"
BOLUM = re.compile(r'^[A-ZÇĞİÖŞÜ\s]{3,40}(BÖLÜM|BAP|KISIM|FASIL)$')


def indir(no: str, hedef: str) -> str:
    """PDF'i indirir. mevzuat.gov.tr eski kanunlar için 1.3.*, yenileri için 1.5.* kullanır."""
    ctx = ssl.create_default_context(cafile=CA) if os.path.exists(CA) else None
    son = None
    for tertip in ('1.5', '1.3', '1.4'):
        url = f'https://www.mevzuat.gov.tr/MevzuatMetin/{tertip}.{no}.pdf'
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=180, context=ctx) as r:
                veri = r.read()
            if veri[:5] == b'%PDF-':
                open(hedef, 'wb').write(veri)
                return url
        except Exception as e:      # 404 beklenen durum: tertip numarası denenerek bulunur
            son = e
    raise SystemExit(f'indirilemedi ({no}): {son}')


def govde_satirlari(pdf: str) -> list:
    """Yalnız gövde puntosundaki metni, satır sırasını koruyarak döndürür."""
    d = pymupdf.open(pdf)
    out = []
    for sayfa in d:
        for blok in sayfa.get_text('dict')['blocks']:
            for satir in blok.get('lines', []):
                parca = [s['text'] for s in satir['spans'] if s['size'] >= GOVDE_PUNTO]
                if not parca:
                    continue
                metin = re.sub(r'\s+', ' ', ''.join(parca)).strip()
                if metin:
                    out.append(metin)
    return out


def birlestir_askida(satirlar: list) -> list:
    """"Geçici Madde" + alt satırda "12" biçimini tek satıra indirir."""
    out, i = [], 0
    while i < len(satirlar):
        s = satirlar[i]
        if MADDE_ASKIDA.match(s) and i + 1 < len(satirlar):
            sonraki = satirlar[i + 1]
            m = re.match(r'^(\d+)\s*[-–—]?\s*(.*)$', sonraki)
            if m:
                out.append(f'{s} {m.group(1)} – {m.group(2)}'.strip())
                i += 2
                continue
        out.append(s)
        i += 1
    return out


# Kenar başlığının önündeki sistematik numarası: "IV. ", "G) ", "2 – ", "§ 3. "
ONEK = re.compile(r'^(?:[A-ZÇĞİÖŞÜ]|[a-zçğıöşü]|[IVXLCMDivxlcmd]+|\d+|§\s*\d+)\s*[\.\)\-–]\s+(.+)$')


def temizle_baslik(s: str) -> str:
    """"IV. Değiştirme yasağı" → "Değiştirme yasağı".

    Havuzdaki diğer kanunlar bu numarayı taşımıyor; taşırsa aynı başlık iki
    farklı biçimde aranır hâle gelir ve başlık ('A' ağırlıklı) eşleşmesi zayıflar.
    """
    m = ONEK.match(s or '')
    return (m.group(1) if m else (s or '')).strip()


def basliktir(s: str) -> bool:
    """Kenar başlığı: iki nokta ile biten kısa satır ("Kapsam ve nitelik:")."""
    return s.endswith(':') and len(s) <= 90 and not MADDE.match(s)


def basliksiz_baslik(onceki: str, iki_onceki: str) -> bool:
    """İki nokta OLMADAN yazılmış kenar başlığı ("Yürütmenin durdurulması").

    Kanunların çoğu kenar başlığını ":" ile bitirir ama hepsi değil; İYUK m.27
    (yürütmenin durdurulması — en çok sorulan idari yargı konularından) tam
    bu yüzden başlıksız kalmıştı ve başlık aramada EN YÜKSEK ağırlığı taşıyor.

    Önceki maddenin gövde son cümlesini yanlışlıkla başlık sanmamak için üç
    koşul birden aranır: satır kısa olacak, cümle gibi bitmeyecek, ve ondan
    önceki satır bitmiş bir cümle/başlık olacak (yani gövde gerçekten kapanmış).
    """
    if not onceki or len(onceki) > 80 or MADDE.match(onceki) or BOLUM.match(onceki):
        return False
    if onceki[-1] in '.,;)':
        return False
    if re.match(r'^\d+[\.\)]', onceki) or onceki[0].islower():
        return False
    return (not iki_onceki) or iki_onceki[-1] in '.:' or BOLUM.match(iki_onceki) is not None


def ayikla(pdf: str) -> list:
    satirlar = birlestir_askida(govde_satirlari(pdf))
    maddeler, bolum, baslik, simdiki = [], '', '', None

    # Bölüm başlığı İKİ satırdır ("BİRİNCİ BÖLÜM" + "Uzlaşma"). İkincisi ayrıca
    # işlenirse maddenin gövdesine sızar ve ondan sonraki gerçek kenar başlığı
    # ("Uzlaştırma") tanınamaz hâle gelir — CMK m.253 tam bu yüzden başlıksız
    # kalmıştı. Bölüm adı satırı burada baştan "yutulmuş" işaretlenir.
    # Bölüm adı BİRDEN ÇOK SATIR olabilir (5510 s. Kanun'da iki satır). Bu yüzden
    # sabit "bir satır" varsayımı yerine, bölüm satırı ile bir SONRAKİ MADDE
    # satırı arasındaki her şey yutulur — yalnız maddeden hemen önceki satır
    # dışarıda bırakılır, çünkü orası maddenin kendi kenar başlığıdır.
    bolum_adi = {}
    yutulan = set()
    for i, s in enumerate(satirlar):
        if not BOLUM.match(s):
            continue
        j = i + 1
        while j < len(satirlar) and j - i <= 6 and not MADDE.match(satirlar[j]):
            j += 1
        if j >= len(satirlar) or j - i > 6:
            continue
        # Maddeden hemen önceki satır HER ZAMAN dışarıda bırakılır: orası
        # maddenin kendi kenar başlığıdır. (Bir kez tersi yazıldı ve 41 başlığı
        # bölüm adı sanıp yuttu.)
        son = j - 2
        parcalar = []
        for k in range(i + 1, son + 1):
            yutulan.add(k)
            parcalar.append(satirlar[k])
        if parcalar:
            bolum_adi[i] = ' '.join(parcalar)

    # Geriye doğru, yutulmuş satırları atlayarak bak.
    def onceki_islenen(idx: int, kac: int) -> str:
        bulunan = []
        j = idx - 1
        while j >= 0 and len(bulunan) < kac:
            if j not in yutulan and not BOLUM.match(satirlar[j]):
                bulunan.append(satirlar[j])
            else:
                bulunan.append('')          # bölüm başlığı: gövde kapanmış demektir
            j -= 1
        while len(bulunan) < kac:
            bulunan.append('')
        return bulunan[kac - 1]

    for idx, s in enumerate(satirlar):
        if BOLUM.match(s):
            bolum = bolum_adi.get(idx, s)
            continue
        if idx in yutulan:
            continue

        m = MADDE.match(s)
        if m:
            # .title() BURADA KULLANILAMAZ: Python 'GEÇİCİ'.title() sonucu
            # 'Geçi̇ci̇' verir — 'İ' küçültülürken araya BİRLEŞEN NOKTA (U+0307)
            # giriyor. Bozuk madde numarası ("Geçi̇ci̇ 1") aramada hiçbir zaman
            # eşleşmez ve 4 kanunda 116 maddeyi sessizce erişilemez yapmıştı.
            # (Aynı Türkçe tuzağı SQL tarafında da yaşandı; bkz. 0045.)
            onek_ham = (m.group(1) or '').strip().translate(TR_ASCII).upper()
            onek = ONEK_ADI.get(onek_ham, '')
            ham_no = re.sub(r'\s*/\s*', '/', m.group(2))
            no = f'{onek} {ham_no}'.strip() if onek else ham_no
            if not baslik and idx >= 1 and basliksiz_baslik(
                    onceki_islenen(idx, 1), onceki_islenen(idx, 2)):
                ham = onceki_islenen(idx, 1).rstrip(':').strip()
                baslik = temizle_baslik(ham)
                # O satır bir önceki maddenin gövdesine eklenmişti; başlık
                # olduğu ancak şimdi anlaşıldı, gövdeden geri alınır. Kıyas
                # HAM satırla yapılır — temizlenmiş başlık ("Zorunlu kayıtlar")
                # gövdenin sonundaki hâliyle ("II - Zorunlu kayıtlar") eşleşmez.
                if simdiki is not None and simdiki['text'].endswith(ham):
                    simdiki['text'] = simdiki['text'][: -len(ham)].strip()
            simdiki = {'no': no, 'text': m.group(3).strip(),
                       'title': baslik, 'section': bolum}
            maddeler.append(simdiki)
            baslik = ''
            continue

        # Kenar başlığı ANCAK hemen ardından madde satırı geliyorsa başlıktır.
        # Yoksa iki nokta ile biten her cümle başlık sanılıyordu: 7036 s.
        # Kanun m.8 "...temyiz yoluna başvurulamaz:" diye bitip liste sayıyor;
        # bu satır m.9'a başlık yazıldı VE m.8'in gövdesinden SİLİNDİ. Yanlış
        # başlıktan kötüsü, hükmün metninden bir cümlenin kaybolmasıdır.
        if basliktir(s) and idx + 1 < len(satirlar) and MADDE.match(satirlar[idx + 1]):
            baslik = temizle_baslik(s[:-1])
            continue

        if simdiki is not None:
            simdiki['text'] += (' ' if simdiki['text'] else '') + s

    for a in maddeler:
        a['text'] = re.sub(r'\s+', ' ', a['text']).strip()
    return maddeler


def sadece_baslik(no: str, slug: str):
    """Var olan JSON'un METNİNE DOKUNMADAN yalnız EKSİK başlıkları doldurur.

    Diğer kanunlar bu betikten önce, başka bir hatla ayıklanmıştı. Onları
    baştan ayıklamak metni de değiştirir ve çalışan bir külliyatı riske atar;
    oysa eksik olan yalnız başlık. Başlık aramada EN YÜKSEK ağırlığı ('A')
    taşıdığı için boş kalması pahalı: 124 maddede boştu ve aralarında TCK m.66
    (dava zamanaşımı), CMK m.253 (uzlaştırma) gibi çok sorulanlar vardı.
    """
    hedef = os.path.join(LAWS, f'{slug}.json')
    kanun = json.load(open(hedef))
    pdf = os.path.join('/tmp', f'law-{no}.pdf')
    if not os.path.exists(pdf):
        print('  ', indir(no, pdf))

    pdf_basliklar = {a['no']: a['title'] for a in ayikla(pdf) if a.get('title')}
    dolan = []
    for a in kanun['articles']:
        if not a.get('title') and pdf_basliklar.get(a['no']):
            a['title'] = pdf_basliklar[a['no']]
            dolan.append((a['no'], a['title']))

    # Önek temizliği var olan başlıklara da uygulanır: aynı başlığın iki
    # biçimde durması aramayı böler.
    for a in kanun['articles']:
        if a.get('title'):
            a['title'] = temizle_baslik(a['title'])

    json.dump(kanun, open(hedef, 'w'), ensure_ascii=False, indent=1)
    bos = sum(1 for a in kanun['articles'] if not a.get('title'))
    print(f"{kanun['short']}: {len(dolan)} başlık dolduruldu, {bos} hâlâ boş")
    for n, t in dolan[:6]:
        print(f'    m.{n:<10} {t}')


def main():
    if len(sys.argv) == 4 and sys.argv[1] == '--sadece-baslik':
        return sadece_baslik(sys.argv[2], sys.argv[3])
    if len(sys.argv) != 5:
        raise SystemExit(__doc__)
    no, slug, kisa, ad = sys.argv[1:5]
    pdf = os.path.join('/tmp', f'law-{no}.pdf')
    if not os.path.exists(pdf):
        print(f'indiriliyor: {no}')
        print('  ', indir(no, pdf))

    maddeler = ayikla(pdf)
    # Aynı numara PDF'te birden çok kez görünebilir (fihrist, atıf); ilki esastır.
    gorulen, tekil = set(), []
    for a in maddeler:
        if a['no'] in gorulen:
            continue
        gorulen.add(a['no'])
        tekil.append(a)

    bos = [a['no'] for a in tekil if len(a['text']) < 15]
    print(f'{kisa}: {len(tekil)} madde (metni 15 karakterden kısa: {len(bos)}) {bos[:10]}')

    hedef = os.path.join(LAWS, f'{slug}.json')
    json.dump({'short': kisa, 'name': ad,
               'source': 'Türk mevzuatı (referans; resmî metin: mevzuat.gov.tr)',
               'articles': tekil},
              open(hedef, 'w'), ensure_ascii=False, indent=1)
    print('yazıldı:', hedef)


if __name__ == '__main__':
    main()
