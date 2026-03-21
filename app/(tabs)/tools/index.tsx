import type { ComponentProps } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme-context';
import { useToastStore } from '@/lib/toast';
import { DwellaHeader } from '@/components/DwellaHeader';

type ToolItem = {
  label: string;
  description: string;
  icon: string;
  color: string;
  route?: string;
  comingSoon?: boolean;
};

export default function ToolsScreen() {
  const router = useRouter();
  const { colors, shadows } = useTheme();

  const TOOLS: ToolItem[] = [
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
    {
      label: 'Documents',
      description: 'Upload and manage property documents',
      icon: 'file-document-outline',
      color: '#6366F1',
      route: '/documents',
    },
    {
      label: 'Maintenance',
      description: 'Track and manage maintenance requests',
      icon: 'wrench-outline',
      color: '#14B8A6',
      route: '/maintenance',
    },
    {
      label: 'Analytics',
      description: 'Financial reports and insights',
      icon: 'chart-bar',
      color: '#F97316',
      comingSoon: true,
    },
  ];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <DwellaHeader style={{ marginHorizontal: -16, marginTop: -16 }} />
      {TOOLS.map((tool) => (
        <TouchableOpacity
          key={tool.label}
          style={[styles.card, { backgroundColor: colors.surface, ...shadows.sm }, tool.comingSoon && { opacity: 0.5 }]}
          onPress={() => {
            if (tool.comingSoon) {
              useToastStore.getState().showToast('Coming soon!', 'info');
            } else {
              router.push(tool.route as Href);
            }
          }}
          activeOpacity={0.8}
        >
          <View style={[styles.iconWrap, { backgroundColor: tool.color + '18' }]}>
            <MaterialCommunityIcons name={tool.icon as ComponentProps<typeof MaterialCommunityIcons>['name']} size={24} color={tool.color} />
          </View>
          <View style={styles.cardText}>
            <View style={styles.cardTitleRow}>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{tool.label}</Text>
              {tool.comingSoon && (
                <Text style={[styles.comingSoonBadge, { color: colors.textDisabled, backgroundColor: colors.surfaceElevated }]}>
                  COMING SOON
                </Text>
              )}
            </View>
            <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>{tool.description}</Text>
          </View>
          {!tool.comingSoon && (
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textDisabled} />
          )}
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
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  comingSoonBadge: {
    fontSize: 9,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
    overflow: 'hidden',
  },
  cardDesc: {
    fontSize: 12,
    marginTop: 2,
  },
});
