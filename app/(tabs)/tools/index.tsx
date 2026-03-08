import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Shadows } from '@/constants/colors';

const TOOLS = [
  {
    label: 'Payments',
    description: 'Track rent payments and confirmations',
    icon: 'receipt',
    route: '/(tabs)/payments',
    color: Colors.primary,
  },
  {
    label: 'Expenses',
    description: 'Log and manage property expenses',
    icon: 'cash-minus',
    route: '/(tabs)/expenses',
    color: Colors.statusPartial,
  },
  {
    label: 'AI Insights',
    description: 'AI-powered analytics and recommendations',
    icon: 'chart-timeline-variant-shimmer',
    route: '/tools/ai-insights',
    color: '#8B5CF6',
  },
  {
    label: 'Smart Reminders',
    description: 'AI-drafted personalized rent reminders',
    icon: 'bell-badge-outline',
    route: '/tools/smart-reminders',
    color: '#EC4899',
  },
  {
    label: 'AI Search',
    description: 'Search your data with natural language',
    icon: 'text-search',
    route: '/tools/ai-search',
    color: '#0EA5E9',
  },
] as const;

export default function ToolsScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {TOOLS.map((tool) => (
        <TouchableOpacity
          key={tool.label}
          style={[styles.card, Shadows.sm]}
          onPress={() => router.push(tool.route as any)}
          activeOpacity={0.8}
        >
          <View style={[styles.iconWrap, { backgroundColor: tool.color + '18' }]}>
            <MaterialCommunityIcons name={tool.icon as any} size={24} color={tool.color} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>{tool.label}</Text>
            <Text style={styles.cardDesc}>{tool.description}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color={Colors.textDisabled} />
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
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
    color: Colors.textPrimary,
  },
  cardDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
