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
import { supabase } from '@/lib/supabase';
import { useAllExpenses } from '@/hooks/useAllExpenses';
import { useProperties } from '@/hooks/useProperties';
import { Expense } from '@/lib/types';
import { Colors } from '@/constants/colors';
import { formatCurrency, getMonthName, getCurrentMonthYear } from '@/lib/utils';
import { getCategoryLabel, getCategoryIcon, getCategoryColor } from '@/lib/expenses';
import { EmptyState } from '@/components/EmptyState';

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

  function renderItem({ item }: { item: ListItem }) {
    if (item.type === 'header') {
      return (
        <Text variant="labelMedium" style={styles.sectionHeader}>
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
      <TouchableOpacity
        style={styles.expenseRow}
        onPress={() => router.push(`/property/${e.property_id}/expenses/${e.id}`)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconBox, { backgroundColor: color + '22' }]}>
          <Icon source={icon} size={20} color={color} />
        </View>
        <View style={styles.expenseInfo}>
          <Text variant="titleSmall" style={styles.categoryText}>{label}</Text>
          {propName ? (
            <Text variant="bodySmall" style={styles.propName} numberOfLines={1}>{propName}</Text>
          ) : null}
          {e.description ? (
            <Text variant="bodySmall" style={styles.descText} numberOfLines={1}>{e.description}</Text>
          ) : null}
          <Text variant="bodySmall" style={styles.dateText}>{dateStr}</Text>
        </View>
        <Text variant="titleSmall" style={styles.amount}>{formatCurrency(e.amount)}</Text>
        <Icon source="chevron-right" size={18} color={Colors.textDisabled} />
      </TouchableOpacity>
    );
  }

  function handleFAB() {
    if (ownedProperties.length === 0) {
      Alert.alert('No Properties', 'Add a property first before logging an expense.');
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
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
            <View style={styles.plCard}>
              <Text variant="labelMedium" style={styles.plTitle}>
                {getMonthName(month)} {year} — P&L
              </Text>
              <View style={styles.plRow}>
                <View style={styles.plItem}>
                  <Text variant="headlineSmall" style={styles.incomeValue}>
                    {formatCurrency(monthlyIncome)}
                  </Text>
                  <Text variant="bodySmall" style={styles.plLabel}>Income</Text>
                </View>
                <View style={styles.plItem}>
                  <Text variant="headlineSmall" style={styles.expenseValue}>
                    {formatCurrency(monthlyExpenses)}
                  </Text>
                  <Text variant="bodySmall" style={styles.plLabel}>Expenses</Text>
                </View>
                <View style={styles.plItem}>
                  <Text
                    variant="headlineSmall"
                    style={[styles.netValue, { color: net >= 0 ? Colors.success : Colors.error }]}
                  >
                    {formatCurrency(net)}
                  </Text>
                  <Text variant="bodySmall" style={styles.plLabel}>Net</Text>
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
                  style={[styles.filterChip, selectedPropertyId === null && styles.filterChipActive]}
                  onPress={() => setSelectedPropertyId(null)}
                  activeOpacity={0.7}
                >
                  <Text
                    variant="labelMedium"
                    style={[styles.filterChipText, selectedPropertyId === null && styles.filterChipTextActive]}
                  >
                    All
                  </Text>
                </TouchableOpacity>
                {ownedProperties.map((p) => {
                  const active = selectedPropertyId === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.filterChip, active && styles.filterChipActive]}
                      onPress={() => setSelectedPropertyId(p.id)}
                      activeOpacity={0.7}
                    >
                      <Text
                        variant="labelMedium"
                        style={[styles.filterChipText, active && styles.filterChipTextActive]}
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
        style={styles.fab}
        color="#fff"
        onPress={handleFAB}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  listContent: { padding: 16, gap: 8, paddingBottom: 88 },
  plCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
  },
  plTitle: {
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  plRow: { flexDirection: 'row', justifyContent: 'space-between' },
  plItem: { flex: 1, alignItems: 'center' },
  incomeValue: { color: Colors.success, fontWeight: '700' },
  expenseValue: { color: Colors.error, fontWeight: '700' },
  netValue: { fontWeight: '700' },
  plLabel: { color: Colors.textSecondary, marginTop: 2 },
  filterRow: { marginBottom: 4 },
  filterContent: { gap: 8, paddingRight: 4 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  filterChipActive: {
    borderColor: Colors.primaryMid,
    backgroundColor: Colors.primarySoft,
  },
  filterChipText: { color: Colors.textSecondary, fontWeight: '500' },
  filterChipTextActive: { color: Colors.primary, fontWeight: '700' },
  sectionHeader: {
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 4,
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
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
  categoryText: { color: Colors.textPrimary, fontWeight: '600' },
  propName: { color: Colors.primary, fontWeight: '500' },
  descText: { color: Colors.textSecondary },
  dateText: { color: Colors.textSecondary },
  amount: { color: Colors.textPrimary, fontWeight: '700' },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    backgroundColor: Colors.primary,
  },
});
