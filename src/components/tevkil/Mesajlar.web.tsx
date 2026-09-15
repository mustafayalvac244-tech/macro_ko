import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { uyar } from '@/lib/uyari';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { isMissingNetworkTables, useConversations, useDeleteConversation, useDmRealtime } from '@/hooks/useChat';
import { useT } from '@/i18n';
import { spacing, typography, kose } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { formatTime } from '@/utils/format';
import { format } from 'date-fns/format';
import { isToday } from 'date-fns/isToday';

/**
 * GELEN KUTUSU — BİLEREK DAR.
 *
 * Bu ekran daha önce üç şeyi birden yapıyordu: yazışma listesi, 21 avukatın
 * tamamında arama yapılabilen bir REHBER (arkadaş kodu paylaşma dahil) ve bir
 * BÜRO sekmesi. 14.09.2026'da ürün sahibi kapsamı seçti: tevkil panosu ve ilan
 * sahibiyle yazışma açılsın, rehber KAPALI kalsın.
 *
 * NEDEN ÖNEMLİ — bu bir görsel sadeleştirme değil, KVKK YÜZEYİ kararı:
 *   • Rehber açık olsaydı aydınlatma metni şunu demek zorunda kalırdı:
 *     "adınız, büronuz ve baro sicil numaranız, siz hiçbir ilan vermeseniz de
 *     tüm kullanıcılara görünür ve aranabilir."
 *   • Rehber kapalıyken doğru cümle çok daha dar: "bu bilgiler YALNIZ ilan
 *     verdiğinizde ya da yazıştığınız kişiye görünür."
 * İkinci cümle kullanıcıya daha az şey açıklar çünkü ürün daha az şey yapar.
 * Metni dar tutabilmek için ürünü dar tutmak gerekiyordu.
 *
 * Bu yüzden useLawyerDirectory / useMyFriendCode / useOffice çağrıları BURADA
 * YOK ve geri eklenmeleri bilinçli bir karar olmalı — sessizce sızmasınlar
 * diye bu not duruyor. (Hook'lar dosyalarında duruyor; silinmediler.)
 *
 * Yazışma listesi `dm_messages` RLS'ine dayanıyor: politika `dm participants
 * select`, yani bir satırı yalnız göndereni ve alıcısı görebiliyor — canlıda
 * ölçüldü (0134).
 */
export default function MesajlarEkrani() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);

  const t = useT();
  const conversations = useConversations();
  const deleteConversation = useDeleteConversation();
  useDmRealtime();

  const sonGorulme = (iso: string) => {
    const d = new Date(iso);
    return isToday(d) ? formatTime(iso) : format(d, 'd.MM.yyyy');
  };

  const silmeyiOnayla = (peerId: string, peerName: string) => {
    uyar(t('chat.deleteTitle'), `${peerName}\n${t('chat.deleteConfirm')}`, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteConversation.mutate(peerId) },
    ]);
  };

  const kurulumGerek = !!conversations.error && isMissingNetworkTables(conversations.error);

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('chat.title')} subtitle={t('tevkil.inboxSubtitle')} showBack />

      {kurulumGerek && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={18} color={colors.danger} />
          <Text style={styles.errorText}>{t('network.setupRequired')}</Text>
        </View>
      )}

      <FlatList
        data={conversations.data ?? []}
        keyExtractor={(c) => c.peer.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !kurulumGerek ? (
            <Card>
              {/* Boş durum metni panoya yönlendiriyor: yazışma buradan değil,
                  bir ilan üzerinden başlıyor. Rehber olmadığı için "kişi ara"
                  demek yanıltıcı olurdu. */}
              <EmptyState
                icon="chatbubbles-outline"
                title={t('chat.empty')}
                description={t('tevkil.inboxEmptyDesc')}
              />
            </Card>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.convRow}
            onPress={() => router.push(`/mesajlar/${item.peer.id}` as Parameters<typeof router.push>[0])}
            onLongPress={() => silmeyiOnayla(item.peer.id, item.peer.full_name)}
            delayLongPress={350}
          >
            <Avatar name={item.peer.full_name} size={48} />
            <View style={styles.rowBody}>
              <Text style={[styles.rowName, item.unread > 0 && styles.rowNameUnread]}>{item.peer.full_name}</Text>
              <Text style={[styles.rowMeta, item.unread > 0 && styles.rowMetaUnread]} numberOfLines={1}>
                {item.lastMessage.body}
              </Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.rowTime}>{sonGorulme(item.lastMessage.created_at)}</Text>
              {item.unread > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{item.unread > 9 ? '9+' : item.unread}</Text>
                </View>
              )}
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    list: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxxl,
    },
    errorBox: {
      flexDirection: 'row',
      gap: spacing.xs,
      backgroundColor: colors.dangerSoft,
      borderWidth: 1,
      borderColor: colors.danger,
      borderRadius: kose(12),
      padding: spacing.sm,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
    },
    errorText: {
      ...typography.caption,
      color: colors.danger,
      flex: 1,
      lineHeight: 18,
    },
    convRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      borderRadius: kose(16),
      padding: spacing.sm,
      marginBottom: spacing.xs,
    },
    rowBody: {
      flex: 1,
    },
    rowName: {
      ...typography.bodyMedium,
      color: colors.textPrimary,
    },
    rowNameUnread: {
      fontWeight: '800',
    },
    rowMeta: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: 1,
    },
    rowMetaUnread: {
      color: colors.textPrimary,
      fontWeight: '600',
    },
    rowRight: {
      alignItems: 'flex-end',
      gap: 4,
    },
    rowTime: {
      ...typography.small,
      color: colors.textMuted,
    },
    unreadBadge: {
      minWidth: 20,
      height: 20,
      borderRadius: kose(10),
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 5,
    },
    unreadBadgeText: {
      color: colors.textInverse,
      fontSize: 11,
      fontWeight: '800',
    },
  });
