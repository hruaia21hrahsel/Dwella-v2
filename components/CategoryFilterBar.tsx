import { ScrollView, TouchableOpacity, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { DocumentCategory } from '@/lib/types';
import { ALL_CATEGORIES, CATEGORY_LABELS } from '@/lib/documents';
import { useTheme } from '@/lib/theme-context';

interface CategoryFilterBarProps {
  selected: DocumentCategory | null; // null = "All"
  onSelect: (category: DocumentCategory | null) => void;
}

export function CategoryFilterBar({ selected, onSelect }: CategoryFilterBarProps) {
  const { colors } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {/* "All" chip */}
      <TouchableOpacity
        onPress={() => onSelect(null)}
        style={[
          styles.chip,
          selected === null
            ? { backgroundColor: colors.primary }
            : { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
        ]}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.chipText,
            { color: selected === null ? colors.textOnPrimary : colors.textSecondary },
          ]}
        >
          All
        </Text>
      </TouchableOpacity>

      {/* Category chips */}
      {ALL_CATEGORIES.map((cat) => {
        const isActive = selected === cat;
        return (
          <TouchableOpacity
            key={cat}
            onPress={() => onSelect(cat)}
            style={[
              styles.chip,
              isActive
                ? { backgroundColor: colors.primary }
                : { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
            ]}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.chipText,
                { color: isActive ? colors.textOnPrimary : colors.textSecondary },
              ]}
            >
              {CATEGORY_LABELS[cat]}
            </Text>
          </TouchableOpacity>
        );
      })}

      {/* Right spacing */}
      <View style={styles.endSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  chip: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '400',
  },
  endSpacer: {
    width: 8,
  },
});
