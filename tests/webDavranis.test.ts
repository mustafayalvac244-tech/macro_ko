import { describe, expect, it, vi } from 'vitest';
import { cikisUyarisiniKur, doluAlanVar, telefonTakvimiSunulurMu, whatsappAdresi } from '../src/utils/webDavranis';
import { hataKapisi, hataKaydedilmeli } from '../src/lib/hataSuzgeci';

/** AJAN 28 — web'e özgü davranışlar (bulgu 1-4). Saf mantık: react-native yok. */
describe('whatsappAdresi', () => {
  it('web: wa.me (whatsapp:// şeması tarayıcıda açılmaz ama hata da vermez → sessiz başarısızlık)', () => {
    expect(whatsappAdresi('web', '905321234567', 'Merhaba dünya')).toBe('https://wa.me/905321234567?text=Merhaba%20d%C3%BCnya');
  });
  it('native: whatsapp:// derin bağlantısı aynen', () => {
    expect(whatsappAdresi('ios', '905321234567', 'a b')).toBe('whatsapp://send?phone=905321234567&text=a%20b');
    expect(whatsappAdresi('android', '905321234567', 'a')).toBe('whatsapp://send?phone=905321234567&text=a');
  });
});

describe('telefonTakvimiSunulurMu', () => {
  it("web'de telefon takvimi YOK (expo-calendar web desteği yok)", () => {
    expect(telefonTakvimiSunulurMu('web')).toBe(false);
    expect(telefonTakvimiSunulurMu('ios')).toBe(true);
    expect(telefonTakvimiSunulurMu('android')).toBe(true);
  });
});

describe('doluAlanVar', () => {
  it('boş/boşluk alanlar kirli sayılmaz', () => {
    expect(doluAlanVar(['', '   ', null, undefined])).toBe(false);
    expect(doluAlanVar(['', 'Ali'])).toBe(true);
  });
});

describe('cikisUyarisiniKur (beforeunload)', () => {
  type Olay = { preventDefault: () => void; returnValue?: string };
  function sahte() {
    const dinleyiciler = new Map<string, (e: Olay) => void>();
    return {
      dinleyiciler,
      addEventListener: (t: string, f: (e: Olay) => void) => void dinleyiciler.set(t, f),
      removeEventListener: (t: string) => void dinleyiciler.delete(t),
    };
  }
  it('kirliyken tarayıcı kapanma/yenilemede uyarır', () => {
    const h = sahte();
    cikisUyarisiniKur(h, true);
    const olay: Olay = { preventDefault: vi.fn(), returnValue: undefined };
    h.dinleyiciler.get('beforeunload')!(olay);
    expect(olay.preventDefault).toHaveBeenCalled();
    expect(olay.returnValue).toBe('');
  });
  it('temizken dinleyici KURULMAZ', () => {
    const h = sahte();
    cikisUyarisiniKur(h, false);
    expect(h.dinleyiciler.size).toBe(0);
  });
  it('temizlik dinleyiciyi kaldırır', () => {
    const h = sahte();
    const temizle = cikisUyarisiniKur(h, true);
    temizle();
    expect(h.dinleyiciler.size).toBe(0);
  });
});

describe('hata kaydı süzgeci', () => {
  it('zararsız tarayıcı gürültüsü kaydedilmez', () => {
    expect(hataKaydedilmeli('ResizeObserver loop completed with undelivered notifications.')).toBe(false);
    expect(hataKaydedilmeli('ResizeObserver loop limit exceeded')).toBe(false);
    expect(hataKaydedilmeli('Script error.')).toBe(false);
  });
  it('gerçek hata kaydedilir', () => {
    expect(hataKaydedilmeli("Cannot read properties of undefined (reading 'id')")).toBe(true);
  });
  it('aynı hata oturumda bir kez, toplam sınırlı (kayıt fırtınası tabloyu doldurmasın)', () => {
    const kapi = hataKapisi(3);
    expect(kapi('a')).toBe(true);
    expect(kapi('a')).toBe(false);
    expect(kapi('b')).toBe(true);
    expect(kapi('c')).toBe(true);
    expect(kapi('d')).toBe(false); // sınır doldu
  });
});
