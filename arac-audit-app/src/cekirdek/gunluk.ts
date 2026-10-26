// DEĞİŞİKLİK GÜNLÜĞÜ — saf hesap (26.10.2026). Kayıt depo.ts'te (göç 10).
//
// Dış değerlendirmede kalite müdürü: "düzeltme ve silme iz bırakmıyor".
// Kayıt düzeltilince değişen sütunların eski/yeni hâli, silinince satırın
// tamamı saklanır. Burada iki iş var: farkı bulmak ve ekranda okunur bir
// cümleye çevirmek ("Kaput — Çizik: demerit 1 → 2").

import { hataTipiAdi, parcaTamAdi } from './katalog';
import { takipAdi } from './takip';
import type { Dil } from './tipler';

export type GunlukTuru = 'hata_duzeltildi' | 'hata_silindi' | 'denetim_duzeltildi' | 'denetim_silindi';

export interface GunlukKaydi {
  id: number; zaman: string; denetimId: string; kayitId: string; tur: GunlukTuru; denetci: string;
  eski: Record<string, unknown> | null; yeni: Record<string, unknown> | null;
}

/** İki satırın farkı: yalnız değişen sütunlar (eski/yeni). Değişen yoksa null. */
export function satirFarki(
  eski: Record<string, unknown>, yeni: Record<string, unknown>, yoksay: readonly string[] = [],
): { eski: Record<string, unknown>; yeni: Record<string, unknown> } | null {
  const e: Record<string, unknown> = {};
  const y: Record<string, unknown> = {};
  for (const k of new Set([...Object.keys(eski), ...Object.keys(yeni)])) {
    if (yoksay.includes(k)) continue;
    if (JSON.stringify(eski[k] ?? null) === JSON.stringify(yeni[k] ?? null)) continue;
    e[k] = eski[k] ?? null;
    y[k] = yeni[k] ?? null;
  }
  return Object.keys(e).length ? { eski: e, yeni: y } : null;
}

/** Sütun → ekrandaki ad. Listede olmayan sütun adıyla yazılır. */
const SUTUN_ADI: Record<string, [string, string]> = {
  parca_id: ['parça', 'part'], ikinci_parca_id: ['2. parça', '2nd part'], hata_tipi_id: ['hata', 'defect'],
  derece: ['demerit', 'demerit'], sinif: ['sınıf', 'class'], sistem: ['sistem', 'system'],
  sorun_tipi: ['tür', 'type'], sorumlu: ['sorumlu', 'responsible'], adet: ['adet', 'qty'],
  konum: ['konum', 'location'], aciklama: ['açıklama', 'note'], durum: ['durum', 'status'],
  kabul_edilebilir: ['kabul edilebilir', 'acceptable'],
  arac_id: ['araç', 'vehicle'], vin: ['şasi', 'VIN'], body_no: ['body no', 'body no'], denetci: ['denetçi', 'auditor'],
  denetim_tipi: ['kaynak', 'source'], spec: ['spec', 'spec'], bitis: ['bitiş', 'end'],
  onlem: ['önlem', 'countermeasure'], giderilme_zamani: ['önlem tarihi', 'countermeasure date'],
  dogrulama_body: ['doğrulama body', 'verification body'],
};

/** ISO zaman damgası mı ("2026-10-26T21:00:01.528Z")? */
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** Yerel saatle "26.10.2026 21:00" (26.10.2026: geçmişte ham ISO yazıyordu — 2. dış değerlendirme). */
export function gunlukZamani(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const iki = (n: number) => String(n).padStart(2, '0');
  return `${iki(d.getDate())}.${iki(d.getMonth() + 1)}.${d.getFullYear()} ${iki(d.getHours())}:${iki(d.getMinutes())}`;
}

const deger = (sutun: string, v: unknown, dil: Dil): string => {
  if (v === null || v === undefined || v === '') return dil === 'en' ? '(empty)' : '(boş)';
  if (typeof v === 'string' && ISO.test(v)) return gunlukZamani(v);
  if (sutun === 'parca_id' || sutun === 'ikinci_parca_id') return parcaTamAdi(String(v), dil);
  if (sutun === 'hata_tipi_id') return hataTipiAdi(String(v), dil);
  if (sutun === 'durum' && v === 'tamam') return dil === 'en' ? 'completed' : 'tamamlandı';
  if (sutun === 'durum' && v === 'devam') return dil === 'en' ? 'in progress' : 'devam ediyor';
  if (sutun === 'durum' && ['acik', 'atandi', 'giderildi', 'kapali'].includes(String(v))) return takipAdi(String(v), dil);
  return String(v);
};

/** Hata satırının kısa adı: "Kaput — Çizik". */
const hataAdi = (r: Record<string, unknown> | null, dil: Dil): string => {
  if (!r) return '';
  const p = r.parca_id ? parcaTamAdi(String(r.parca_id), dil) : '';
  const p2 = r.ikinci_parca_id ? ` ↔ ${parcaTamAdi(String(r.ikinci_parca_id), dil)}` : '';
  const h = r.hata_tipi_id ? hataTipiAdi(String(r.hata_tipi_id), dil) : '';
  return [`${p}${p2}`, h].filter(Boolean).join(' — ');
};

/** Günlük kaydının ekrandaki cümlesi. */
export function gunlukOzeti(k: Pick<GunlukKaydi, 'tur' | 'eski' | 'yeni'>, dil: Dil): string {
  const en = dil === 'en';
  if (k.tur === 'hata_silindi') {
    return `${en ? 'Deleted' : 'Silindi'}: ${hataAdi(k.eski, dil)}${k.eski?.derece !== undefined ? ` (demerit ${String(k.eski.derece)})` : ''}`;
  }
  if (k.tur === 'denetim_silindi') {
    const n = Array.isArray(k.eski?.hatalar) ? (k.eski!.hatalar as unknown[]).length : 0;
    return en ? `Audit deleted (${n} ${n === 1 ? 'record' : 'records'})` : `Denetim silindi (${n} kayıt)`;
  }
  const degisen = Object.keys(k.yeni ?? {}).map((s) => {
    const ad = SUTUN_ADI[s]?.[en ? 1 : 0] ?? s;
    return `${ad} ${deger(s, k.eski?.[s], dil)} → ${deger(s, k.yeni?.[s], dil)}`;
  });
  if (k.tur === 'hata_duzeltildi') {
    // Parça/hata değiştiyse eski adı yaz: neyin değiştiği anlaşılsın.
    return `${en ? 'Edited' : 'Düzeltildi'}: ${degisen.join(', ')}`;
  }
  // Bitirme ve yeniden açma birer düzeltme değil, olay: kendi adıyla yazılır
  // (2. dış değerlendirme: olağan bir bitirme "Denetim düzeltildi" görünüyordu).
  const durumEski = k.eski?.durum;
  const durumYeni = k.yeni?.durum;
  const digerleri = Object.keys(k.yeni ?? {}).filter((s) => s !== 'durum' && s !== 'bitis');
  if (durumEski === 'devam' && durumYeni === 'tamam' && !digerleri.length) {
    const z = typeof k.yeni?.bitis === 'string' ? ` (${gunlukZamani(k.yeni.bitis)})` : '';
    return en ? `Audit completed${z}` : `Denetim tamamlandı${z}`;
  }
  if (durumEski === 'tamam' && durumYeni === 'devam' && !digerleri.length) {
    return en ? 'Audit reopened' : 'Denetim yeniden açıldı';
  }
  return `${en ? 'Audit edited' : 'Denetim düzeltildi'}: ${degisen.join(', ')}`;
}
