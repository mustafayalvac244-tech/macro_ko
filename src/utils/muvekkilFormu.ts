import type { Client, ClientType } from '@/types/database';
import { isValidTCKN } from '@/utils/tckn';

/** Müvekkil formunun ekranda tuttuğu değerler (boş alan = ''). */
export interface MuvekkilFormu {
  fullName: string;
  company: string;
  title: string;
  clientType: ClientType;
  email: string;
  phone: string;
  address: string;
  tcNo: string;
  notes: string;
}

/** Kaydedilen satır — hooks/useClients ClientInput ile aynı alanlar. */
export type MuvekkilKaydi = Pick<
  Client,
  'full_name' | 'company' | 'title' | 'client_type' | 'email' | 'phone' | 'address' | 'tc_no' | 'notes'
>;

export const BOS_MUVEKKIL_FORMU: MuvekkilFormu = {
  fullName: '',
  company: '',
  title: '',
  clientType: 'gercek',
  email: '',
  phone: '',
  address: '',
  tcNo: '',
  notes: '',
};

/**
 * Düzenlemede formu kayıttan doldurur.
 *
 * ŞİRKET ALANI DA YÜKLENİR (09.10.2026). Formda şirket kutusu yok ama kayıtta
 * alan dolu olabiliyor (ör. scripts/demo-hesap-ornek-veri.sql yazıyor; canlıda
 * kaç kayıtta dolu olduğu ölçülmedi). Eskiden form bu alanı hiç yüklemiyordu
 * ve kaydederken `company: null` gönderiyordu: telefonu düzeltmek için açılan
 * kayıtta şirket adı sessizce siliniyordu. Gizli alan olduğu gibi geri yazılır.
 */
export function formuDoldur(c: Client): MuvekkilFormu {
  return {
    fullName: c.full_name,
    company: c.company ?? '',
    title: c.title ?? '',
    clientType: c.client_type ?? 'gercek',
    email: c.email ?? '',
    phone: c.phone ?? '',
    address: c.address ?? '',
    tcNo: c.tc_no ?? '',
    notes: c.notes ?? '',
  };
}

/** Formdan kaydedilecek satırı üretir; boş metin null olur. */
export function kayitYuku(f: MuvekkilFormu): MuvekkilKaydi {
  const bosNull = (v: string) => v.trim() || null;
  return {
    full_name: f.fullName.trim(),
    company: bosNull(f.company),
    title: bosNull(f.title),
    client_type: f.clientType,
    email: bosNull(f.email),
    phone: bosNull(f.phone),
    address: bosNull(f.address),
    tc_no: bosNull(f.tcNo),
    notes: bosNull(f.notes),
  };
}

export type KaydetmeEngeli = 'adYok' | 'tcEksik' | 'tcGecersiz';

/**
 * Kaydı engelleyen ilk sebep; yoksa null.
 *
 * GEÇERSİZ T.C. KİMLİK NO KAYDEDİLMEZ (09.10.2026). Form kontrol hanesi tutmayan
 * numaraya kırmızı uyarı gösteriyor ama kaydetmeye izin veriyordu; numara
 * dilekçe künyesine olduğu gibi yazılıyordu. Kısa numarayı
 * veritabanının biçim kısıtı (0053, `^[1-9][0-9]{10}$`) reddediyor, ama
 * kullanıcıya yalnız "işlem tamamlanamadı, tekrar deneyin" dönüyordu. Kayıt
 * ekranındaki kuralın aynısı (app/(auth)/signup.tsx): girilirse geçerli olmalı.
 *
 * Tüzel kişide T.C. kutusu gizli; kullanıcının göremediği alan yüzünden kayıt
 * engellenmez.
 */
export function kaydetmeEngeli(f: MuvekkilFormu): KaydetmeEngeli | null {
  if (!f.fullName.trim()) return 'adYok';
  return tcSorunu(f);
}

/** T.C. kutusunun sorunu (ad boş olsa da ayrıca gösterilebilsin diye ayrı). */
export function tcSorunu(f: Pick<MuvekkilFormu, 'clientType' | 'tcNo'>): 'tcEksik' | 'tcGecersiz' | null {
  const tc = f.tcNo.trim();
  if (f.clientType !== 'gercek' || !tc) return null;
  if (tc.length < 11) return 'tcEksik';
  return isValidTCKN(tc) ? null : 'tcGecersiz';
}
