import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

export { yolSade } from '@/lib/kullanimOlay';

/**
 * KULLANIM SAYACI — 03.10.2026, bkz. 0165_kullanim_sayac.
 *
 * Yalnız "gün × olay × platform" sayacı artar; kullanıcı/cihaz kimliği, metin
 * GÖNDERİLMEZ. Aynı olay bir uygulama açılışında bir kez sayılır (aynı ekrana
 * on kez dönmek akışı çarpıtmasın). Hata sessizce yutulur: ölçüm, uygulamayı
 * asla bozmamalı.
 */
const sayilan = new Set<string>();

/**
 * REKLAM KAYNAĞI — 04.10.2026. Reklam bağlantısı `/app/?utm_source=meta&utm_campaign=ekim`
 * gibi gelirse web'de BİR KEZ 'kaynak:meta/ekim' sayılır (kişi yok, sayaç).
 * "Hangi reklam kayıt getiriyor" sorusunun tek ölçüsü bu; App Store tarafı
 * App Store Connect'in kendi analitiğinde.
 */
export function reklamKaynaginiKaydet(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    const q = new URLSearchParams(window.location.search);
    const sade = (v: string | null) => (v ?? '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 30);
    const kaynak = sade(q.get('utm_source'));
    ilkKaynagiSakla(kaynak, sade(q.get('utm_campaign')));
    if (!kaynak) return;
    const kampanya = sade(q.get('utm_campaign'));
    kullanimKaydet(`kaynak:${kaynak}${kampanya ? `/${kampanya}` : ''}`);
  } catch {
    // ölçüm uygulamayı bozmaz
  }
}

export function kullanimKaydet(olay: string): void {
  const platform = Platform.OS === 'ios' || Platform.OS === 'android' || Platform.OS === 'web' ? Platform.OS : null;
  if (!platform || sayilan.has(olay)) return;
  sayilan.add(olay);
  void supabase.rpc('kullanim_kaydet', { p_olay: olay, p_platform: platform }).then(
    () => {},
    () => {}
  );
}

/**
 * KULLANICI NEREDEN GELDİ — 06.10.2026 (ürün sahibi: "yönetici panelinde yeni
 * kullanıcılar var, nereden geldiklerini de ekle").
 *
 * Yukarıdaki sayaç kişisizdi; hangi KULLANICININ hangi kaynaktan geldiği
 * bilinmiyordu. İlk ziyarette (web) kaynak tarayıcıda saklanır ve kayıt
 * olurken hesabın üstverisine `kayit_kaynagi` olarak yazılır. Yalnız
 * platform, utm kaynağı/kampanyası ve gelinen sitenin ALAN ADI tutulur —
 * tam adres, arama terimi ya da kişisel veri tutulmaz.
 *
 * "İlk temas" kuralı: ilk gelişteki kaynak korunur, sonraki ziyaretler ezmez.
 */
const ILK_KAYNAK_ANAHTARI = 'vekil_ilk_kaynak';

interface IlkKaynak {
  kaynak?: string;
  kampanya?: string;
  site?: string;
}

function ilkKaynagiSakla(kaynak: string, kampanya: string): void {
  try {
    if (window.localStorage.getItem(ILK_KAYNAK_ANAHTARI)) return;
    let site = '';
    try {
      const ref = document.referrer ? new URL(document.referrer).hostname : '';
      // Kendi sitemizden /app'e geçiş "kaynak" değildir.
      if (ref && !/(^|\.)vekilpro\.app$/i.test(ref)) site = ref.replace(/^www\./, '').slice(0, 60);
    } catch {
      site = '';
    }
    const kayit: IlkKaynak = {};
    if (kaynak) kayit.kaynak = kaynak;
    if (kampanya) kayit.kampanya = kampanya;
    if (site) kayit.site = site;
    window.localStorage.setItem(ILK_KAYNAK_ANAHTARI, JSON.stringify(kayit));
  } catch {
    // depolama kapalıysa kaynak bilinmez; kayıt yine olur
  }
}

/** Kayıtta hesaba yazılacak kaynak bilgisi. */
export function kayitKaynagi(): { platform: string } & IlkKaynak {
  const platform = Platform.OS;
  if (Platform.OS !== 'web' || typeof window === 'undefined') return { platform };
  try {
    const ham = window.localStorage.getItem(ILK_KAYNAK_ANAHTARI);
    const k = ham ? (JSON.parse(ham) as IlkKaynak) : {};
    return { platform, ...k };
  } catch {
    return { platform };
  }
}
