import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '@/theme/theme';
import { formatDate, formatFileSize, titleCase } from '@/utils/format';
import type { CaseDocument, DocumentWithCase } from '@/types/database';

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  pleading: 'document-text-outline',
  contract: 'reader-outline',
  evidence: 'shield-checkmark-outline',
  correspondence: 'mail-outline',
  court_order: 'ribbon-outline',
  invoice: 'receipt-outline',
  identification: 'card-outline',
  other: 'document-outline',
};

function iconForMimeType(mimeType: string | null): keyof typeof Ionicons.glyphMap | null {
  if (!mimeType) return null;
  if (mimeType.startsWith('image/')) return 'image-outline';
  if (mimeType === 'application/pdf') return 'document-outline';
  return null;
}

interface DocumentListItemProps {
  document: CaseDocument | DocumentWithCase;
  onPress: () => void;
  onDelete?: () => void;
  showCase?: boolean;
}

export function DocumentListItem({ document, onPress, onDelete, showCase = false }: DocumentListItemProps) {
  const icon = iconForMimeType(document.mime_type) ?? CATEGORY_ICONS[document.category] ?? 'document-outline';
  const caseInfo = 'case' in document ? document.case : null;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={18} color={colors.gold} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {document.name}
        </Text>
        {showCase && caseInfo && (
          <Text style={styles.caseTitle} numberOfLines={1}>
            {caseInfo.title}
          </Text>
        )}
        <Text style={styles.meta} numberOfLines={1}>
          {titleCase(document.category)} · {formatFileSize(document.file_size)} · {formatDate(document.uploaded_at)}
        </Text>
      </View>
      {onDelete && (
        <Pressable onPress={onDelete} hitSlop={8} style={styles.deleteButton}>
          <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  body: {
    flex: 1,
  },
  title: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  caseTitle: {
    ...typography.caption,
    color: colors.primary,
    marginTop: 1,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 1,
  },
  deleteButton: {
    padding: spacing.xs,
  },
});
