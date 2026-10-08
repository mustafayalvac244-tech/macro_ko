import { createElement, type ChangeEvent } from 'react';
import { kose, radius, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';

/**
 * WEB TARİH SEÇİCİ (08.10.2026).
 *
 * BULUNAN KUSUR (50 denetçi taraması; yayındaki web paketinde de görüldü).
 * @react-native-community/datetimepicker web'de `null` döndürür ("not
 * supported on: web"). 13 ekranda tarih düğmesine basınca HİÇBİR ŞEY
 * olmuyordu: süre asistanı her zaman BUGÜNDEN hesaplıyor ve yanlış son günü
 * kaydediyordu; duruşma/görev formu, takvimde erteleme, faiz ve kıdem
 * hesaplayıcı, dava detayındaki karar/tebliğ tarihi web'de değiştirilemiyordu.
 *
 * Bu dosya aynı props'u alır ve tarayıcının kendi tarih/saat kutusunu çizer.
 * Ekranlar yalnız içe aktarma yolunu değiştirdi; telefondaki davranış aynen.
 * onChange imzası aynı: (olay, tarih). Olay türü her zaman 'set'.
 */
type Mod = 'date' | 'time' | 'datetime' | 'countdown';

interface Props {
  value: Date;
  mode?: Mod;
  minimumDate?: Date;
  maximumDate?: Date;
  onChange?: (event: { type: 'set'; nativeEvent: { timestamp: number } }, date?: Date) => void;
  // Telefona özgü, web'de yok sayılır:
  locale?: string;
  display?: string;
  is24Hour?: boolean;
}

const iki = (n: number) => String(n).padStart(2, '0');
const gun = (d: Date) => `${d.getFullYear()}-${iki(d.getMonth() + 1)}-${iki(d.getDate())}`;
const saat = (d: Date) => `${iki(d.getHours())}:${iki(d.getMinutes())}`;

export function inputDegeri(d: Date, mod: Mod): string {
  if (Number.isNaN(d.getTime())) return '';
  if (mod === 'time') return saat(d);
  if (mod === 'datetime') return `${gun(d)}T${saat(d)}`;
  return gun(d);
}

/** Kutudaki değeri, mevcut tarihin seçilmeyen kısmını koruyarak Date'e çevirir. */
export function inputtanTarih(deger: string, onceki: Date, mod: Mod): Date | null {
  if (mod === 'time') {
    const m = /^(\d{2}):(\d{2})/.exec(deger);
    if (!m) return null;
    const d = new Date(onceki);
    d.setHours(Number(m[1]), Number(m[2]), 0, 0);
    return d;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(deger);
  if (!m) return null;
  const d = new Date(onceki);
  d.setFullYear(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (m[4] != null) d.setHours(Number(m[4]), Number(m[5]), 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default function TarihSecici({ value, mode = 'date', minimumDate, maximumDate, onChange }: Props) {
  const { colors } = useTheme();
  const mod: Mod = mode === 'countdown' ? 'time' : mode;
  const tur = mod === 'time' ? 'time' : mod === 'datetime' ? 'datetime-local' : 'date';
  return createElement('input', {
    type: tur,
    value: inputDegeri(value, mod),
    min: minimumDate ? inputDegeri(minimumDate, mod) : undefined,
    max: maximumDate ? inputDegeri(maximumDate, mod) : undefined,
    'aria-label': tur,
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      const d = inputtanTarih(e.target.value, value, mod);
      if (d) onChange?.({ type: 'set', nativeEvent: { timestamp: d.getTime() } }, d);
    },
    style: {
      fontFamily: `${typography.body.fontFamily}, system-ui, sans-serif`,
      fontSize: 16,
      padding: '10px 12px',
      marginTop: 8,
      borderRadius: kose(radius.md),
      border: `1px solid ${colors.border}`,
      background: colors.surface,
      color: colors.textPrimary,
      colorScheme: 'light dark',
      maxWidth: '100%',
    },
  });
}

export type DateTimePickerEvent = { type: 'set'; nativeEvent: { timestamp: number } };
