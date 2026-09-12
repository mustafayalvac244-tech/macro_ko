#!/usr/bin/env python3
"""KANUN HASADI — scripts/kanunlar.json'daki eksik kanunları indirir ve ekler.

Kullanım:
    python3 scripts/kanun-hasat.py            # eksikleri hasat et
    python3 scripts/kanun-hasat.py --liste    # ne var ne yok, indirme yapma
    python3 scripts/kanun-hasat.py --tumu     # var olanları da yeniden çek
    python3 scripts/kanun-hasat.py --adet 5   # bu koşuda en fazla 5 kanun

NEDEN BU DOSYA VAR. Mevzuat havuzumuz 16 kanunla sınırlıydı ve bu bir ürün
sınırıydı: içtihat araması canlı olarak UYAP'a giderken mevzuat araması
yalnız pakete gömülü bu 16 dosyayı görüyordu. Kanun eklemek üç ayrı yeri elle
güncellemeyi gerektiriyordu (JSON, index.json, İKİ yükleyici haritası) —
biri unutulursa kanun sessizce görünmez kalırdı. Bu betik üçünü de yazıyor.

parse-law-pdf.py İŞİN ZOR KISMINI ZATEN YAPIYOR: punto ile dipnot ayıklama,
Ek/Geçici madde, harfli alt maddeler (m.169/a), bölüm başlıkları, Türkçe
büyük/küçük harf tuzakları. Burada o mantık yeniden yazılmıyor, içe
aktarılıyor — iki ayrı ayıklayıcı olursa ikisi zamanla ayrışır.

DOĞRULAMA — SESSİZ BOZULMAYA KARŞI. Kanun numaraları listeye elle yazıldı.
Yanlış bir numara başka bir kanunun PDF'ini indirip onu BİZİM yazdığımız adla
kaydedebilir; kullanıcı "Kat Mülkiyeti Kanunu" açıp bambaşka bir metin görür
ve bunu kimse fark etmez. Bu yüzden her PDF'in ilk sayfalarında listedeki
'dogrula' ifadelerinin HEPSİ aranır; biri eksikse dosya YAZILMAZ ve hasat o
kanunu hatayla atlar.
"""
import importlib.util
import json
import os
import re
import sys
import tempfile

# ÇIKTI TAMPONLANMAZ. İlk koşuda 45 dakika boyunca TEK SATIR bile
# görünmedi: Python, çıktı bir terminale değil dosyaya/boruya gidince
# tamponluyor ve iş iptal edilince tampon kayboluyor. Yani hasat ne
# yaptığını söyleyemeden öldü. Artık her satır anında yazılıyor.
os.environ.setdefault('PYTHONUNBUFFERED', '1')
try:
    sys.stdout.reconfigure(line_buffering=True)
except Exception:                                                  # noqa: BLE001
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LAWS = os.path.join(ROOT, 'src', 'data', 'laws')
LISTE = os.path.join(ROOT, 'scripts', 'kanunlar.json')

# parse-law-pdf.py tire içerdiği için normal import edilemiyor.
_spec = importlib.util.spec_from_file_location(
    'parse_law_pdf', os.path.join(ROOT, 'scripts', 'parse-law-pdf.py'))
PARSE = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(PARSE)

import pymupdf  # noqa: E402  (parse-law-pdf zaten gerektiriyor)

TR_ASCII = str.maketrans('İIıŞşĞğÜüÖöÇçÂâÎîÛû', 'IIiSsGgUuOoCcAaIiUu')


def sadelestir(s: str) -> str:
    """Karşılaştırma için Türkçe harfleri ASCII'ye indirir ve boşlukları tekler.

    PDF metninde 'Kat Mülkiyeti' bazen 'Kat Mülkiyeti' bazen farklı boşlukla
    geçiyor; ayrıca bazı PDF'lerde 'İ' farklı kodlanıyor. Doğrulama bu yüzden
    ham metin üzerinde değil, sadeleştirilmiş metin üzerinde yapılıyor.
    """
    return re.sub(r'\s+', ' ', (s or '').translate(TR_ASCII)).lower()


def pdf_ilk_sayfalar(pdf: str, kac: int = 3) -> str:
    d = pymupdf.open(pdf)
    parcalar = []
    for i, sayfa in enumerate(d):
        if i >= kac:
            break
        parcalar.append(sayfa.get_text())
    return ' '.join(parcalar)


def dogrula(pdf: str, beklenen: list) -> list:
    """Eksik olan doğrulama ifadelerini döndürür (boş liste = geçti)."""
    metin = sadelestir(pdf_ilk_sayfalar(pdf))
    return [b for b in beklenen if sadelestir(b) not in metin]


def index_yaz():
    """index.json'u diskteki dosyalardan YENİDEN kurar.

    Elle tutulan bir dizin, dosyalarla ayrışır. Burada tek doğru kaynak
    src/data/laws/*.json'ın kendisi.
    """
    girdiler = []
    for ad in sorted(os.listdir(LAWS)):
        if not ad.endswith('.json') or ad == 'index.json':
            continue
        slug = ad[:-5]
        k = json.load(open(os.path.join(LAWS, ad), encoding='utf-8'))
        girdiler.append({'short': k['short'], 'name': k['name'],
                         'slug': slug, 'count': len(k.get('articles', []))})
    # Kanunlar ekranında büyükten küçüğe değil, ALFABETİK değil: var olan
    # sıralama korunuyor (index.json'daki mevcut sıra), yenileri sona ekleniyor.
    # Sıra değişince kullanıcının alıştığı liste karışır.
    eski = []
    yol = os.path.join(LAWS, 'index.json')
    if os.path.exists(yol):
        eski = [e['slug'] for e in json.load(open(yol, encoding='utf-8'))]
    sirali = ([g for s in eski for g in girdiler if g['slug'] == s] +
              [g for g in girdiler if g['slug'] not in eski])
    json.dump(sirali, open(yol, 'w', encoding='utf-8'), ensure_ascii=False)
    return sirali


def yukleyici_yaz(sirali: list):
    """loader.ts ve loader.web.ts içindeki statik require haritasını yeniler.

    Metro dinamik require yolu çözemediği için harita statik olmak zorunda;
    yani yeni bir kanun buraya da yazılmalı. Elle yazılınca unutuluyor ve
    kanun index'te görünüp açılmıyor — sessiz kusur. Burada üretiliyor.
    """
    satirlar = '\n'.join(
        f"  '{g['slug']}': () => require('./{g['slug']}.json') as LawFile,"
        for g in sirali)
    blok = ('const FILES: Record<string, () => LawFile> = {\n'
            f'{satirlar}\n'
            '};')
    degisen = []
    for ad in ('loader.ts', 'loader.web.ts'):
        yol = os.path.join(LAWS, ad)
        if not os.path.exists(yol):
            continue
        metin = open(yol, encoding='utf-8').read()
        yeni = re.sub(r'const FILES: Record<string, \(\) => LawFile> = \{.*?\n\};',
                      blok, metin, count=1, flags=re.S)
        if yeni != metin:
            open(yol, 'w', encoding='utf-8').write(yeni)
            degisen.append(ad)
    return degisen


def erisim_yoklamasi() -> str:
    """mevzuat.gov.tr'ye ulaşılıyor mu — HASAT BAŞLAMADAN sorulur.

    NEDEN. İlk koşuda hasat 45 dakika hiç çıktı vermeden takıldı ve iptal
    oldu; kimse sebebini bilmiyordu. Oysa sorulacak tek bir soru vardı:
    "sunucuya ulaşılıyor mu?" Artık ilk iş o soruluyor ve cevap raporun en
    başında yazıyor. Ulaşılamıyorsa 30 kanunu tek tek denemenin anlamı yok.
    """
    import urllib.request, ssl
    url = 'https://www.mevzuat.gov.tr/MevzuatMetin/1.5.6098.pdf'   # TBK, kesin var
    # CA PAKETİ AYIKLAYICIYLA AYNI OLMALI. İlk yazdığımda yoklama varsayılan
    # kök sertifikaları kullanıyordu ve geliştirme ortamında
    # CERTIFICATE_VERIFY_FAILED veriyordu — yani "erişim yok" diyordu, oysa
    # sorun ağ değil sertifika zinciriydi. İki yer aynı bağlamı kullanmazsa
    # yoklama, hasadın kendisiyle farklı bir şeyi ölçer.
    ctx = ssl.create_default_context(cafile=PARSE.CA) if os.path.exists(PARSE.CA) else ssl.create_default_context()
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=25, context=ctx) as r:
            bas = r.read(5)
        return '' if bas == b'%PDF-' else f'beklenmedik yanıt: {bas!r}'
    except Exception as e:                                          # noqa: BLE001
        return f'{type(e).__name__}: {e}'


def hasat(hepsi: bool, adet: int, yalniz_liste: bool) -> int:
    veri = json.load(open(LISTE, encoding='utf-8'))
    kanunlar = veri['kanunlar']

    eksik = [k for k in kanunlar
             if hepsi or not os.path.exists(os.path.join(LAWS, f"{k['slug']}.json"))]

    print(f'listede {len(kanunlar)} kanun · havuzda yok: {len(eksik)}')
    if yalniz_liste:
        for k in eksik:
            print(f"  eksik: {k['no']:>5}  {k['kisa']:<7} {k['ad']}")
        return 0
    if not eksik:
        print('eklenecek kanun yok.')
        return 0

    sorun = erisim_yoklamasi()
    if sorun:
        print(f'\nMEVZUAT.GOV.TR\'YE ULAŞILAMIYOR — hasat yapılmadı.\n  {sorun}\n')
        print('Bu bir kod hatası değil, ağ erişimi sorunu. Kanun PDF\'leri elle')
        print('indirilip /tmp/law-<no>.pdf olarak konursa betik onları kullanır.')
        return 0
    print('mevzuat.gov.tr: erişim var\n')

    if adet:
        eksik = eksik[:adet]

    eklenen, basarisiz = [], []
    for k in eksik:
        no, slug, kisa, ad = k['no'], k['slug'], k['kisa'], k['ad']
        pdf = os.path.join(tempfile.gettempdir(), f'law-{no}.pdf')
        try:
            if not os.path.exists(pdf):
                PARSE.indir(no, pdf)

            # DOĞRULAMA — yazmadan ÖNCE.
            eksik_ifade = dogrula(pdf, k.get('dogrula') or [])
            if eksik_ifade:
                basarisiz.append((no, ad, f'PDF doğrulaması geçmedi, bulunamayan: {eksik_ifade}'))
                continue

            maddeler = PARSE.ayikla(pdf)
            gorulen, tekil = set(), []
            for a in maddeler:
                if a['no'] in gorulen:
                    continue
                gorulen.add(a['no'])
                tekil.append(a)

            # BOŞ ÇIKAN AYIKLAMA YAZILMAZ. Bir PDF taranmış görüntüden
            # oluşuyorsa (eski kanunlarda olur) metin katmanı yoktur ve
            # ayıklama sıfır madde döner; bunu kaydetmek havuzda "0 maddelik
            # kanun" bırakır ve arama sessizce boş döner.
            if len(tekil) < 5:
                basarisiz.append((no, ad, f'yalnız {len(tekil)} madde ayıklandı — yazılmadı'))
                continue

            json.dump({'short': kisa, 'name': ad,
                       'source': 'Türk mevzuatı (referans; resmî metin: mevzuat.gov.tr)',
                       'articles': tekil},
                      open(os.path.join(LAWS, f'{slug}.json'), 'w', encoding='utf-8'),
                      ensure_ascii=False, indent=1)
            eklenen.append((kisa, len(tekil), ad))
            print(f'  + {kisa:<7} {len(tekil):>5} madde  {ad}')
        except SystemExit as e:
            basarisiz.append((no, ad, str(e)))
        except Exception as e:                       # noqa: BLE001
            basarisiz.append((no, ad, f'{type(e).__name__}: {e}'))

    if eklenen:
        sirali = index_yaz()
        degisen = yukleyici_yaz(sirali)
        toplam = sum(g['count'] for g in sirali)
        print(f'\nindex.json yenilendi: {len(sirali)} kanun, {toplam} madde')
        if degisen:
            print('yükleyici haritası güncellendi:', ', '.join(degisen))

    print(f'\neklenen: {len(eklenen)} · başarısız: {len(basarisiz)}')
    for no, ad, sebep in basarisiz:
        print(f'  ! {no:>5} {ad}\n      {sebep}')

    # BAŞARISIZ KANUN KOŞUYU DÜŞÜRMEZ. Bir kanunun PDF'i o gün erişilemez
    # olabilir ya da numarası yanlış yazılmış olabilir; bu, doğru çekilen
    # diğer kanunların eklenmesini engellememeli. Sonuç raporda görünür ve
    # eksik kanun bir sonraki koşuda yeniden denenir.
    return 0


def main():
    a = sys.argv[1:]
    adet = 0
    if '--adet' in a:
        adet = int(a[a.index('--adet') + 1])
    return hasat('--tumu' in a, adet, '--liste' in a)


if __name__ == '__main__':
    sys.exit(main())
