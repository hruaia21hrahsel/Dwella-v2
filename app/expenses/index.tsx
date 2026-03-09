import { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Text, FAB, ActivityIndicator, Icon } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAllExpenses } from '@/hooks/useAllExpenses';
import { useProperties } from '@/hooks/useProperties';
import { Expense } from '@/lib/types';
import { useTheme } from '@/lib/theme-context';
import { formatCurrency, getMonthName, getCurrentMonthYear } from '@/lib/utils';
import { getCategoryLabel, getCategoryIcon, getCategoryColor } from '@/lib/expenses';
import { EmptyState } from '@/components/EmptyState';
import { ListSkeleton } from '@/components/ListSkeleton';
import { AnimatedCard } from '@/components/AnimatedCard';
import { useToastStore } from '@/lib/toast';

function groupByMonth(expenses: Expense[]): { title: string; key: string; data: Expense[] }[] {
  const map: Record<string, Expense[]> = {};
  for (const e of expenses) {
    const d = new Date(e.expense_date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!map[key]) map[key] = [];
    map[key].push(e);
  }
  return Object.entries(map)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, data]) => {
      const [year, month] = key.split('-');
      return { key, title: `${getMonthName(parseInt(month))} ${year}`, data };
    });
}

export default function GlobalExpensesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { expenses, isLoading, refresh } = useAllExpenses();
  const { ownedProperties } = useProperties();
  const { month, year } = getCurrentMonthYear();

  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [monthlyIncome, setMonthlyIncome] = useState(0);

  const fetchMonthlyIncome = useCallback(async () => {
    const propIds = ownedProperties.map((p) => p.id);
    if (propIds.length === 0) { setMonthlyIncome(0); return; }

    const query = supabase
      .from('payments')
      .select('amount_paid')
      .eq('month', month)
      .eq('year', year)
      .in('property_id', selectedPropertyId ? [selectedPropertyId] : propIds);

    const { data } = await query;
    const total = (data ?? []).reduce((s: number, p: any) => s + (p.amount_paid ?? 0), 0);
    setMonthlyIncome(total);
  }, [ownedProperties, selectedPropertyId, month, year]);

  useEffect(() => { fetchMonthlyIncome(); }, [fetchMonthlyIncome]);

  // Filter by selected property
  const filtered = selectedPropertyId
    ? expenses.filter((e) => e.property_id === selectedPropertyId)
    : expenses;

  const monthlyExpenses = filtered
    .filter((e) => {
      const d = new Date(e.expense_date);
      return d.getMonth() + 1 === month && d.getFullYear() === year;
    })
    .reduce((s, e) => s + e.amount, 0);

  const net = monthlyIncome - monthlyExpenses;
  const sections = groupByMonth(filtered);

  // Build a property name lookup
  const propNameMap: Record<string, string> = {};
  for (const p of ownedProperties) propNameMap[p.id] = p.name;

  // Flatten for FlatList
  type ListItem =
    | { type: 'header'; title: string }
    | { type: 'expense'; expense: Expense };

  const listData: ListItem[] = [];
  for (const section of sections) {
    listData.push({ type: 'header', title: section.title });
    for (const e of section.data) {
      listData.push({ type: 'expense', expense: e });
    }
  }

  function renderItem({ item, index }: { item: ListItem; index: number }) {
    if (item.type === 'header') {
      return (
        <Text variant="labelMedium" style={[styles.sectionHeader, { color: colors.textSecondary }]}>
          {item.title}
        </Text>
      );
    }
    const { expense: e } = item;
    const color = getCategoryColor(e.category);
    const icon = getCategoryIcon(e.category);
    const label = getCategoryLabel(e.category);
    const dateStr = new Date(e.expense_date).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
    });
    const propName = propNameMap[e.property_id];

    return (
      <AnimatedCard index={index}>
      <TouchableOpacity
        style={[styles.expenseRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => router.push(`/property/${e.property_id}/expenses/${e.id}`)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconBox, { backgroundColor: color + '22' }]}>
          <Icon source={icon} size={20} color={color} />
        </View>
        <View style={styles.expenseInfo}>
          <Text variant="titleSmall" style={[styles.categoryText, { color: colors.textPrimary }]}>{label}</Text>
          {propName ? (
            <Text variant="bodySmall" style={[styles.propName, { color: colors.primary }]} numberOfLines={1}>{propName}</Text>
          ) : null}
          {e.description ? (
            <Text variant="bodySmall" style={[styles.descText, { color: colors.textSecondary }]} numberOfLines={1}>{e.description}</Text>
          ) : null}
          <Text variant="bodySmall" style={[styles.dateText, { color: colors.textSecondary }]}>{dateStr}</Text>
        </View>
        <Text variant="titleSmall" style={[styles.amount, { color: colors.textPrimary }]}>{formatCurrency(e.amount)}</Text>
        <Icon source="chevron-right" size={18} color={colors.textDisabled} />
      </TouchableOpacity>
      </AnimatedCard>
    );
  }

  function handleFAB() {
    if (ownedProperties.length === 0) {
      useToastStore.getState().showToast('Add a property first before logging an expense.', 'info');
      return;
    }
    if (ownedProperties.length === 1) {
      router.push(`/property/${ownedProperties[0].id}/expenses/add`);
      return;
    }
    Alert.alert(
      'Select Property',
      'Which property is this expense for?',
      ownedProperties.map((p) => ({
        text: p.name,
        onPress: () => router.push(`/property/${p.id}/expenses/add`),
      })),
      { cancelable: true }
    );
  }

  if (isLoading) {
    return <ListSkeleton count={4} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Top bar */}
      <View style={[styles.topBar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.topBarBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text variant="titleMedium" style={[styles.topBarTitle, { color: colors.textPrimary }]}>Expenses</Text>
        <View style={styles.topBarBtn} />
      </View>
      <FlatList
        data={listData}
        keyExtractor={(item, index) =>
          item.type === 'header' ? `h-${item.title}` : `e-${item.expense.id}`
        }
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {/* P&L card */}
            <View style={[styles.plCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text variant="labelMedium" style={[styles.plTitle, { color: colors.textSecondary }]}>
                {getMonthName(month)} {year} — P&L
              </Text>
              <View style={styles.plRow}>
                <View style={styles.plItem}>
                  <Text variant="headlineSmall" style={[styles.incomeValue, { color: colors.success }]}>
                    {formatCurrency(monthlyIncome)}
                  </Text>
                  <Text variant="bodySmall" style={[styles.plLabel, { color: colors.textSecondary }]}>Income</Text>
                </View>
                <View style={styles.plItem}>
                  <Text variant="headlineSmall" style={[styles.expenseValue, { color: colors.error }]}>
                    {formatCurrency(monthlyExpenses)}
                  </Text>
                  <Text variant="bodySmall" style={[styles.plLabel, { color: colors.textSecondary }]}>Expenses</Text>
                </View>
                <View style={styles.plItem}>
                  <Text
                    variant="headlineSmall"
                    style={[styles.netValue, { color: net >= 0 ? colors.success : colors.error }]}
                  >
                    {formatCurrency(net)}
                  </Text>
                  <Text variant="bodySmall" style={[styles.plLabel, { color: colors.textSecondary }]}>Net</Text>
                </View>
              </View>
            </View>

            {/* Property filter chips */}
            {ownedProperties.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterRow}
                contentContainerStyle={styles.filterContent}
              >
                <TouchableOpacity
                  style={[styles.filterChip, { borderColor: colors.border, backgroundColor: colors.surface }, selectedPropertyId === null && { borderColor: colors.primaryMid, backgroundColor: colors.primarySoft }]}
                  onPress={() => setSelectedPropertyId(null)}
                  activeOpacity={0.7}
                >
                  <Text
                    variant="labelMedium"
                    style={[styles.filterChipText, { color: colors.textSecondary }, selectedPropertyId === null && { color: colors.primary, fontWeight: '700' }]}
                  >
                    All
                  </Text>
                </TouchableOpacity>
                {ownedProperties.map((p) => {
                  const active = selectedPropertyId === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.filterChip, { borderColor: colors.border, backgroundColor: colors.surface }, active && { borderColor: colors.primaryMid, backgroundColor: colors.primarySoft }]}
                      onPress={() => setSelectedPropertyId(p.id)}
                      activeOpacity={0.7}
                    >
                      <Text
                        variant="labelMedium"
                        style={[styles.filterChipText, { color: colors.textSecondary }, active && { color: colors.primary, fontWeight: '700' }]}
                      >
                        {p.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </>
        }
        ListEmptyComponent={
          <EmptyState
            icon="cash-minus"
            title="No expenses yet"
            subtitle="Tap + to log an expense for one of your properties."
          />
        }
      />
      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: colors.primary }]}
        color="#fff"
        onPress={handleFAB}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topBarBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '700',
  },
  listContent: { padding: 16, gap: 8, paddingBottom: 88 },
  plCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  plTitle: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  plRow: { flexDirection: 'row', justifyContent: 'space-between' },
  plItem: { flex: 1, alignItems: 'center' },
  incomeValue: { fontWeight: '700' },
  expenseValue: { fontWeight: '700' },
  netValue: { fontWeight: '700' },
  plLabel: { marginTop: 2 },
  filterRow: { marginBottom: 4 },
  filterContent: { gap: 8, paddingRight: 4 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  filterChipText: { fontWeight: '500' },
  sectionHeader: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 4,
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseInfo: { flex: 1, gap: 2 },
  categoryText: { fontWeight: '600' },
  propName: { fontWeight: '500' },
  descText: {},
  dateText: {},
  amount: { fontWeight: '700' },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
  },
});
