import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme-context';
import { DwellaHeader } from '@/components/DwellaHeader';

export default function ToolsScreen() {
  const router = useRouter();
  const { colors, shadows } = useTheme();

  const TOOLS = [
    {
      label: 'Payment History',
      description: 'Track rent payments and confirmations',
      icon: 'receipt',
      route: '/payments',
      color: colors.primary,
    },
    {
      label: 'Expenses',
      description: 'Log and manage property expenses',
      icon: 'cash-minus',
      route: '/expenses',
      color: colors.statusPartial,
    },
  ] as const;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <DwellaHeader style={{ marginHorizontal: -16, marginTop: -16 }} />
      {TOOLS.map((tool) => (
        <TouchableOpacity
          key={tool.label}
          style={[styles.card, { backgroundColor: colors.surface, ...shadows.sm }]}
          onPress={() => router.push(tool.route as any)}
          activeOpacity={0.8}
        >
          <View style={[styles.iconWrap, { backgroundColor: tool.color + '18' }]}>
            <MaterialCommunityIcons name={tool.icon as any} size={24} color={tool.color} />
          </View>
          <View style={styles.cardText}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{tool.label}</Text>
            <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>{tool.description}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textDisabled} />
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 16,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardDesc: {
    fontSize: 12,
    marginTop: 2,
  },
});
