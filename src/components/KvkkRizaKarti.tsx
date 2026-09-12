// AÇIK RIZANIN DURUMU VE GERİ ALINMASI — vaat edilen düğmenin kendisi.
// ---------------------------------------------------------------------------
// NEDEN YAZILDI. Aydınlatma metni ve kayıt ekranı, rızanın "dilediğiniz zaman
// Ayarlar'dan geri alınabileceğini" söylüyordu; GERİ ALMA EKRANI YOKTU. Yani
// imzalatılan metin, uygulamanın yapmadığı bir şeyi vaat ediyordu — bu, bu
// projede daha önce düzeltilen hatanın (gizlilik metni "hiçbir veri
// paylaşılmaz" derken metinlerin ABD'ye gitmesi) aynısıdır. Metni doğru hâle
// getirmenin iki yolu vardı: vaadi silmek ya da düğmeyi yazmak. Doğrusu
// düğmeyi yazmak.
//
// EKLEMELİ GÜNLÜK. Geri alma bir GÜNCELLEME değil, yeni bir satırdır
// (migration 0128): rıza bir delildir, üzerine yazmak delili yok etmektir.
// "Şu an rıza var mı" sorusu en son satıra bakılarak cevaplanır.
//
// GERİ ALMA HESABI KAPATMAZ. Yalnız yapay zekâ özellikleri durur; kullanıcıya
// da bu söylenir.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { KvkkImza, type KvkkKanit } from '@/components/KvkkImza';
import { KVKK_SURUM } from '@/config/kvkk';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { formatDateTime } from '@/utils/format';
import { radius, spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

interface Satir {
  onay: boolean;
  surum: string;
  verildi_at: string;
}

export function KvkkRizaKarti({ tr }: { tr: boolean }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id ?? null;

  const [son, setSon] = useState<Satir | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [isliyor, setIsliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [imzaAcik, setImzaAcik] = useState(false);

  const getir = useCallback(async () => {
    if (!userId) {
      setYukleniyor(false);
      return;
    }
    setYukleniyor(true);
    // RLS zaten yalnız kendi satırlarını verir; yine de user_id süzgeci
    // konuyor — güvenliği tek bir katmana bırakmamak için.
    const { data, error } = await supabase
      .from('kvkk_onay')
      .select('onay, surum, verildi_at')
      .eq('user_id', userId)
      .eq('tur', 'yurtdisi_ai')
      .order('verildi_at', { ascending: false })
      .limit(1);
    if (error) setHata(tr ? 'Rıza kaydı okunamadı.' : 'Could not read the consent record.');
    setSon((data?.[0] as Satir | undefined) ?? null);
    setYukleniyor(false);
  }, [userId, tr]);

  useEffect(() => {
    getir();
  }, [getir]);

  const yaz = async (onay: boolean, kanit: KvkkKanit | null) => {
    if (!userId) return;
    setIsliyor(true);
    setHata(null);
    const { error } = await supabase.from('kvkk_onay').insert({
      user_id: userId,
      tur: 'yurtdisi_ai',
      surum: kanit?.surum ?? KVKK_SURUM,
      onay,
      kaynak: 'ayarlar',
      kanit,
    });
    setIsliyor(false);
    if (error) {
      // Sessizce yutmuyoruz: kullanıcı "geri aldım" sanıp rızası duruyor
      // olmamalı. Hata görünür ve düğme yeniden denenebilir kalır.
      setHata(tr ? 'Kayıt yazılamadı, tekrar deneyin.' : 'Could not write the record, please try again.');
      return;
    }
    await getir();
  };

  // Oturum yoksa (kayıt öncesi `/kvkk` görüntüleniyorsa) kart hiç çizilmez:
  // rıza kaydı kişiye bağlıdır.
  if (!userId) return null;

  const rizaVar = son?.onay === true;

  return (
    <>
      {/* Card tek bir stil nesnesi alıyor, dizi değil — birleştirme burada. */}
      <Card style={StyleSheet.flatten([styles.kart, rizaVar ? styles.kartAcik : styles.kartKapali])}>
        <View style={styles.baslikSatiri}>
          <Ionicons
            name={rizaVar ? 'checkmark-circle' : 'close-circle-outline'}
            size={18}
            color={rizaVar ? colors.success : colors.textMuted}
          />
          <Text style={styles.baslik}>
            {tr ? 'Yapay zekâ açık rızanız' : 'Your AI explicit consent'}
          </Text>
        </View>

        {yukleniyor ? (
          <ActivityIndicator color={colors.primary} style={styles.bekle} />
        ) : (
          <>
            <Text style={styles.durum}>
              {rizaVar
                ? (tr
                    ? `RIZA VERİLMİŞ DURUMDA.\nMetin sürümü ${son?.surum} · ${son ? formatDateTime(son.verildi_at) : ''}`
                    : `CONSENT IS IN PLACE.\nNotice version ${son?.surum} · ${son ? formatDateTime(son.verildi_at) : ''}`)
                : son
                  ? (tr
                      ? `RIZA GERİ ALINMIŞ.\n${formatDateTime(son.verildi_at)} tarihinde geri alındı; yapay zekâ özellikleri kapalı.`
                      : `CONSENT WITHDRAWN.\nWithdrawn on ${formatDateTime(son.verildi_at)}; the AI features are off.`)
                  : (tr
                      ? 'KAYIT BULUNAMADI. Hesabınız, rıza kaydı tutulmaya başlanmadan önce açılmış olabilir. Yapay zekâ özelliklerini kullanmadan önce metni okuyup imzalamanız gerekir.'
                      : 'NO RECORD FOUND. Your account may predate consent logging. Please read and sign the notice before using the AI features.')}
            </Text>

            {hata && <Text style={styles.hata}>{hata}</Text>}

            {rizaVar ? (
              <Button
                label={tr ? 'Rızamı geri al' : 'Withdraw my consent'}
                onPress={() => yaz(false, null)}
                variant="secondary"
                loading={isliyor}
                fullWidth
                icon="close-circle-outline"
              />
            ) : (
              <Button
                label={tr ? 'Metni oku ve rıza ver' : 'Read the notice and consent'}
                onPress={() => setImzaAcik(true)}
                loading={isliyor}
                fullWidth
                icon="create-outline"
              />
            )}

            <Text style={styles.not}>
              {tr
                ? 'Geri almak hesabınızı kapatmaz, kayıtlarınızı silmez: yalnız yapay zekâ özellikleri durur. Verilen ve geri alınan her rıza ayrı ayrı, tarihi ve metin sürümüyle saklanır; eski kayıt silinmez.'
                : 'Withdrawal does not close your account or delete records: only the AI features stop. Every consent and withdrawal is stored separately with its date and notice version; earlier records are never erased.'}
            </Text>
          </>
        )}
      </Card>

      <KvkkImza
        visible={imzaAcik}
        tr={tr}
        onVazgec={() => setImzaAcik(false)}
        onImza={(kanit) => {
          setImzaAcik(false);
          yaz(true, kanit);
        }}
      />
    </>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  kart: { marginBottom: spacing.sm, borderWidth: 1, borderRadius: radius.md, gap: spacing.sm },
  kartAcik: { borderColor: colors.success },
  kartKapali: { borderColor: colors.border },
  baslikSatiri: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  baslik: { ...typography.h3, color: colors.textPrimary, flexShrink: 1 },
  bekle: { alignSelf: 'flex-start' },
  durum: { ...typography.caption, color: colors.textSecondary, lineHeight: 20 },
  hata: { ...typography.small, color: colors.danger },
  not: { ...typography.small, color: colors.textMuted, lineHeight: 16 },
});
