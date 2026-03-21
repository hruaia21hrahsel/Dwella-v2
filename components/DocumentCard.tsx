import { type ComponentProps } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Document } from '@/lib/types';
import { MIME_ICONS, DEFAULT_MIME_ICON, CATEGORY_LABELS, formatFileSize } from '@/lib/documents';
import { useTheme } from '@/lib/theme-context';

interface DocumentCardProps {
  document: Document;
  currentUserId: string;
  onPress: (doc: Document) => void;
  onDelete?: (doc: Document) => void;
}

export function DocumentCard({ document, currentUserId, onPress, onDelete }: DocumentCardProps) {
  const { colors } = useTheme();
  const iconName = (MIME_ICONS[document.mime_type] ?? DEFAULT_MIME_ICON) as ComponentProps<typeof MaterialCommunityIcons>['name'];
  const isUploader = document.uploader_id === currentUserId;
  const shortDate = new Date(document.created_at).toLocaleDateString();

  return (
    <TouchableOpacity
      onPress={() => onPress(document)}
      activeOpacity={0.7}
      style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      {/* MIME icon */}
      <View style={[styles.iconContainer, { backgroundColor: colors.primarySoft }]}>
        <MaterialCommunityIcons name={iconName} size={22} color={colors.primary} />
      </View>

      {/* Text column */}
      <View style={styles.info}>
        <Text
          style={[styles.name, { color: colors.textPrimary }]}
          numberOfLines={1}
        >
          {document.name}
        </Text>
        <View style={styles.meta}>
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>
            {CATEGORY_LABELS[document.category]}
          </Text>
          <Text style={[styles.dot, { color: colors.textSecondary }]}> · </Text>
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>
            {formatFileSize(document.file_size)}
          </Text>
          <Text style={[styles.dot, { color: colors.textSecondary }]}> · </Text>
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>
            {shortDate}
          </Text>
        </View>
      </View>

      {/* Delete button — only visible for uploader */}
      {isUploader && onDelete && (
        <TouchableOpacity
          onPress={() => onDelete(document)}
          hitSlop={8}
          accessibilityLabel="Delete document"
          style={styles.deleteBtn}
        >
          <MaterialCommunityIcons name="delete-outline" size={22} color={colors.error} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 72,
    paddingHorizontal: 16,
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: 14,
    lineHeight: 20,
  },
  dot: {
    fontSize: 14,
  },
  deleteBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
