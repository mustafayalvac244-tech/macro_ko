#!/usr/bin/env python3
# Kanun maddelerinin KENAR BAŞLIKLARINI resmî mevzuat.gov.tr PDF'lerinden çıkarır
# ve src/data/laws/*.json içindeki maddelere `title` alanı olarak ekler.
#
# Başlık, PDF'te "MADDE N-" satırından hemen önceki kenar başlığı satırıdır
# (ör. "III. Aşırı ifa güçlüğü" -> "Aşırı ifa güçlüğü").
#
# Kullanım: python3 scripts/extract-law-titles.py
# Gerekli: pymupdf (fitz). Çıktı: JSON'lar güncellenir + kapsama raporu.
import json, re, os, sys, urllib.request, ssl

import fitz  # pymupdf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LAWS = os.path.join(ROOT, 'src', 'data', 'laws')
CA = '/root/.ccr/ca-bundle.crt'

# slug -> mevzuat.gov.tr kanun numarası
LAW_NO = {
    'turk-ceza': '5237',
    'turk-medeni': '4721',
    'turk-borclar': '6098',
    'hmk': '6100',
    'cmk': '5271',
    'ttk': '6102',
    'is-kanunu': '4857',
}

# Kenar başlığı önündeki numaralandırma (A. / I. / 1. / a) / I - / § 3.)
NUM = re.compile(r'^(?:[A-ZÇĞİÖŞÜ]|[a-zçğıöşü]|[IVXLCMDivxlcmd]+|\d+|§\s*\d+)\s*[\.\)\-–]\s*(.+)$')
MADDE = re.compile(r'^\s*(?:MADDE|Madde)\s+(\d+)(?:/([A-ZÇĞİÖŞÜ]))?\s*[-–]')
NOISE_KW = ('değiştir', 'eklenm', 'yürürlükten', 'kaldırıl', 'mülga', 'ibaresi', 'ibare',
            'fıkra', 'bent', 'şeklinde')


def clean_heading(s: str) -> str:
    m = NUM.match(s)
    t = m.group(1).strip() if m else s.strip()
    t = re.sub(r'\s*\(\d+\)\s*$', '', t)          # sonda dipnot (1)
    t = re.sub(r'(?<=\D)\d+$', '', t)             # sonda üstsimge dipnot: Tehdit51 -> Tehdit
    t = re.sub(r'\s+', ' ', t).strip()
    return t


def is_noise(s: str) -> bool:
    """Değişiklik/dipnot satırı — başlık değil, atlanmalı."""
    if re.fullmatch(r'[\d\s\.\-–—\(\)]+', s):      # yalnız rakam/noktalama
        return True
    if s.startswith('('):
        return True
    low = s.lower()
    return any(k in low for k in NOISE_KW)


def is_heading(s: str) -> bool:
    if not s or len(s) > 75:
        return False
    if MADDE.match(s) or is_noise(s):
        return False
    if s.endswith('.') and len(s) > 55:            # uzun cümle = gövde
        return False
    return True


def download(no: str, dest: str) -> bool:
    url = f'https://www.mevzuat.gov.tr/MevzuatMetin/1.5.{no}.pdf'
    ctx = ssl.create_default_context(cafile=CA) if os.path.exists(CA) else None
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, timeout=90, context=ctx) as r, open(dest, 'wb') as f:
            f.write(r.read())
        return True
    except Exception as e:
        print(f'  ! indirilemedi: {e}')
        return False


def extract_titles(pdf_path: str) -> dict:
    doc = fitz.open(pdf_path)
    text = '\n'.join(page.get_text('text') for page in doc)
    lines = [l.strip() for l in text.split('\n')]
    titles = {}
    for i, l in enumerate(lines):
        m = MADDE.match(l)
        if not m:
            continue
        no = m.group(1)
        # Yukarı doğru yürü: boş/dipnot/değişiklik satırlarını atla, ilk
        # başlık-benzeri satırı al. Başka MADDE'ye veya gövdeye çarpınca dur.
        j, steps = i - 1, 0
        while j >= 0 and steps < 6:
            s = lines[j]
            if not s:
                j -= 1
                continue
            if MADDE.match(s):
                break
            if is_noise(s):
                j -= 1
                steps += 1
                continue
            if is_heading(s):
                titles.setdefault(no, clean_heading(s))
            break
    return titles


def main():
    tmp = os.environ.get('TMPDIR', '/tmp')
    total_arts = total_titled = 0
    for slug, no in LAW_NO.items():
        jpath = os.path.join(LAWS, f'{slug}.json')
        if not os.path.exists(jpath):
            print(f'{slug}: JSON yok, atlanıyor')
            continue
        pdf = os.path.join(tmp, f'{slug}.pdf')
        if not os.path.exists(pdf):
            if not download(no, pdf):
                continue
        titles = extract_titles(pdf)
        data = json.load(open(jpath, encoding='utf-8'))
        arts = data['articles']
        hit = 0
        for a in arts:
            t = titles.get(str(a['no']))
            if t:
                a['title'] = t
                hit += 1
            else:
                a.pop('title', None)
        json.dump(data, open(jpath, 'w', encoding='utf-8'), ensure_ascii=False)
        total_arts += len(arts)
        total_titled += hit
        print(f'{slug:14s} {hit:4d}/{len(arts):4d} başlık  (PDF\'ten {len(titles)})')
    print(f'\nTOPLAM: {total_titled}/{total_arts} maddeye başlık eklendi')


if __name__ == '__main__':
    main()
