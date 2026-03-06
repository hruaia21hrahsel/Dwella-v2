import { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, FAB, ActivityIndicator, Icon } from 'react-native-paper';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useExpenses } from '@/hooks/useExpenses';
import { Expense } from '@/lib/types';
import { Colors } from '@/constants/colors';
import { formatCurrency, getMonthName, getCurrentMonthYear } from '@/lib/utils';
import { getCategoryLabel, getCategoryIcon, getCategoryColor } from '@/lib/expenses';
import { EmptyState } from '@/components/EmptyState';

function groupByMonth(expenses: Expense[]): { title: string; data: Expense[] }[] {
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
      return { title: `${getMonthName(parseInt(month))} ${year}`, data };
    });
}

export default function ExpensesScreen() {
  const { id: propertyId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { expenses, isLoading, refresh } = useExpenses(propertyId ?? null);
  const { month, year } = getCurrentMonthYear();

  const [monthlyIncome, setMonthlyIncome] = useState(0);

  const fetchMonthlyIncome = useCallback(async () => {
    if (!propertyId) return;
    const { data } = await supabase
      .from('payments')
      .select('amount_paid')
      .eq('property_id', propertyId)
      .eq('month', month)
      .eq('year', year);
    const total = (data ?? []).reduce((s: number, p: any) => s + (p.amount_paid ?? 0), 0);
    setMonthlyIncome(total);
  }, [propertyId, month, year]);

  useEffect(() => { fetchMonthlyIncome(); }, [fetchMonthlyIncome]);

  const monthlyExpenses = expenses
    .filter((e) => {
      const d = new Date(e.expense_date);
      return d.getMonth() + 1 === month && d.getFullYear() === year;
    })
    .reduce((s, e) => s + e.amount, 0);

  const net = monthlyIncome - monthlyExpenses;
  const sections = groupByMonth(expenses);

  // Flatten for FlatList with section headers
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

    return (
      <TouchableOpacity
        style={styles.expenseRow}
        onPress={() => router.push(`/property/${propertyId}/expenses/${e.id}`)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconBox, { backgroundColor: color + '22' }]}>
          <Icon source={icon} size={20} color={color} />
        </View>
        <View style={styles.expenseInfo}>
          <Text variant="titleSmall" style={styles.categoryText}>{label}</Text>
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

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Expenses',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: Colors.surface, height: 64 },
          headerTintColor: Colors.textPrimary,
        }}
      />
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
          }
          ListEmptyComponent={
            <EmptyState
              icon="cash-minus"
              title="No expenses yet"
              subtitle="Tap + to log a repair, insurance, or other expense."
            />
          }
        />
        <FAB
          icon="plus"
          style={styles.fab}
          color="#fff"
          onPress={() => router.push(`/property/${propertyId}/expenses/add`)}
        />
      </View>
    </>
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
