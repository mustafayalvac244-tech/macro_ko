import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { useT } from '@/i18n';
import type { Client } from '@/types/database';

interface ClientListItemProps {
  client: Client;
  onPress: () => void;
}

export function ClientListItem({ client, onPress }: ClientListItemProps) {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);

  const t = useT();
  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.row}>
        <Avatar name={client.full_name} size={44} />
        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={1}>
            {client.full_name}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {client.company || client.email || client.phone || t('clients.noContact')}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>
    </Card>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  body: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  name: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
