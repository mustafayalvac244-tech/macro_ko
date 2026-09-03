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

# "Madde 5 –", "MADDE 5-", "Ek Madde 1 –", "Geçici Madde 12 –"
MADDE = re.compile(r'^((?:Ek|EK|Geçici|GEÇİCİ)\s+)?(?:Madde|MADDE)\s+(\d+)\s*[-–—]\s*(.*)$')
# Satır sonunda "Madde" kalıp numarası alt satıra düşmüş olabilir.
MADDE_ASKIDA = re.compile(r'^((?:Ek|EK|Geçici|GEÇİCİ)\s+)?(?:Madde|MADDE)$')
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


def basliktir(s: str) -> bool:
    """Kenar başlığı: iki nokta ile biten kısa satır ("Kapsam ve nitelik:")."""
    return s.endswith(':') and len(s) <= 90 and not MADDE.match(s)


def ayikla(pdf: str) -> list:
    satirlar = birlestir_askida(govde_satirlari(pdf))
    maddeler, bolum, baslik, simdiki = [], '', '', None

    for idx, s in enumerate(satirlar):
        if BOLUM.match(s):
            # Bölüm adı bir sonraki satırdadır ("BİRİNCİ BÖLÜM" / "Genel Esaslar").
            sonraki = satirlar[idx + 1] if idx + 1 < len(satirlar) else ''
            bolum = sonraki if sonraki and not MADDE.match(sonraki) and not basliktir(sonraki) else s
            continue

        m = MADDE.match(s)
        if m:
            onek = (m.group(1) or '').strip().title()      # "Ek" / "Geçici"
            no = f'{onek} {m.group(2)}'.strip() if onek else m.group(2)
            simdiki = {'no': no, 'text': m.group(3).strip(),
                       'title': baslik, 'section': bolum}
            maddeler.append(simdiki)
            baslik = ''
            continue

        if basliktir(s):
            baslik = s[:-1].strip()
            continue

        if simdiki is not None:
            simdiki['text'] += (' ' if simdiki['text'] else '') + s

    for a in maddeler:
        a['text'] = re.sub(r'\s+', ' ', a['text']).strip()
    return maddeler


def main():
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
