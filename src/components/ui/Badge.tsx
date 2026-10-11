import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { radius, spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import { useBuyukHarf } from '@/lib/buyukHarf';
import { okunurRenk, zeminUstune } from '@/utils/kontrast';

interface BadgeProps {
  label: string;
  color: string;
  backgroundColor: string;
}

export function Badge({ label, color, backgroundColor }: BadgeProps) {
  // useTheme(): tema değişince bu bileşen yeniden çizilsin, makeStyles güncel
  // token'ları okusun ve yazı kontrastı güncel yüzeye göre hesaplansın.
  const { colors } = useTheme();
  const styles = makeStyles();
  // YAZI KONTRASTI (10.10.2026): rozet yazısı 11 punto; durum/öncelik renkleri
  // açık temalarda kendi %12-13'lük zemini üstünde 2,5–4,4:1 veriyordu (örn.
  // Klasik'te "Beklemede" 2,94:1). Renk, kartın da sayfanın da üstünde 4,5:1'e
  // ulaşana dek temanın ana yazı rengine kaydırılır; zaten yeterli renk AYNEN kalır.
  const yazi = okunurRenk(
    color,
    [colors.surface, colors.bg].map((yuzey) => zeminUstune(backgroundColor, yuzey)),
    colors.textPrimary,
  );
  // BÜYÜK HARF CSS'TEN DEĞİL JS'TEN — Türkçe "i" tuzağı.
  // Stilde `textTransform: 'uppercase'` vardı ve "Kritik" rozeti ekranda
  // **KRITIK** diye çıkıyordu (15.09.2026, dava listesi ekran görüntüsünde
  // görüldü). CSS dil bilmiyor; `toLocaleUpperCase('tr-TR')` biliyor.
  // Ayrıntı ve İngilizce tarafındaki ters hata: src/lib/buyukHarf.ts
  const buyut = useBuyukHarf();
  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Text style={[styles.label, { color: yazi }]} numberOfLines={1}>
        {buyut(label)}
      </Text>
    </View>
  );
}

// STİLLER RENDER ANINDA ÜRETİLİYOR — modül düzeyinde DEĞİL.
// Sebep (15.09.2026): yazı tipi/boyut/köşe artık temaya bağlı
// (bkz. src/theme/tokens.ts). Modül düzeyinde `StyleSheet.create` bir kez
// çalışıp DONAR: uygulama Klasik temayla açılıp Terminal'e geçilince bu dosya
// eski Manrope boyutlarında kalır ve ekranın geri kalanıyla uyumsuz görünür.
// Ölçüldü: 94 dosya zaten fabrika kullanıyordu, donuk kalan 3 dosyadan biri
// burasıydı.
const makeStyles = () => StyleSheet.create({
  container: {
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  label: {
    ...typography.small,
  },
});
