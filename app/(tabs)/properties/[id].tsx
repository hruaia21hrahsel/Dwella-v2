import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, IconButton, ActivityIndicator, Chip, Button, Icon } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack, useFocusEffect } from 'expo-router';
import { useProperties } from '@/hooks/useProperties';
import { useTenants } from '@/hooks/useTenants';
import { useExpenses } from '@/hooks/useExpenses';
import { TenantCard } from '@/components/TenantCard';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';
import { getCategoryLabel, getCategoryIcon, getCategoryColor } from '@/lib/expenses';

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, bumpPropertyRefresh } = useAuthStore();
  const { ownedProperties, refresh: refreshProps } = useProperties();
  const { tenants, isLoading, refresh: refreshTenants } = useTenants(id);
  const { expenses, refresh: refreshExpenses } = useExpenses(id ?? null);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const property = ownedProperties.find((p) => p.id === id);
  const isOwner = property?.owner_id === user?.id;

  const occupiedCount = tenants.filter((t) => t.invite_status === 'accepted').length;

  // Re-fetch expenses when screen regains focus (e.g. after adding an expense)
  useFocusEffect(
    useCallback(() => {
      refreshExpenses();
    }, [refreshExpenses])
  );

  function handleRefresh() {
    refreshProps();
    refreshTenants();
    refreshExpenses();
  }

  async function handleArchiveProperty() {
    if (!id) return;
    setDeleting(true);

    // Archive all tenants first
    await supabase
      .from('tenants')
      .update({ is_archived: true, archived_at: new Date().toISOString() })
      .eq('property_id', id);

    // Archive property
    await supabase
      .from('properties')
      .update({ is_archived: true, archived_at: new Date().toISOString() })
      .eq('id', id);

    setDeleting(false);
    setDeleteDialogVisible(false);
    bumpPropertyRefresh();
    router.back();
  }

  if (isLoading && !property) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!property) {
    return (
      <View style={styles.centered}>
        <Text>Property not found.</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: property.name,
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: Colors.surface, height: 64 } as any,
          headerRight: isOwner
            ? () => (
                <View style={styles.headerActions}>
                  <IconButton
                    icon="pencil"
                    size={22}
                    onPress={() => router.push({ pathname: '/property/create', params: { id } })}
                  />
                  <IconButton
                    icon="delete"
                    size={22}
                    iconColor={Colors.error}
                    onPress={() => setDeleteDialogVisible(true)}
                  />
                </View>
              )
            : undefined,
        }}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />}
      >
        {/* Stats + Address row */}
        <View style={styles.infoCard}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{property.total_units}</Text>
              <Text style={styles.statLabel}>Units</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{occupiedCount}</Text>
              <Text style={styles.statLabel}>Occupied</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { fontSize: 15 }]}>
                {tenants.length > 0
                  ? formatCurrency(tenants.reduce((sum, t) => sum + t.monthly_rent, 0))
                  : '₹0'}
              </Text>
              <Text style={styles.statLabel}>Rent/mo</Text>
            </View>
          </View>
          <View style={styles.addressRow}>
            <MaterialCommunityIcons name="map-marker-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.addressText} numberOfLines={1}>{property.address}, {property.city}</Text>
          </View>
        </View>

        {/* Tenants */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Tenants</Text>
            {isOwner && (
              <TouchableOpacity
                style={styles.addTenantBtn}
                onPress={() => router.push(`/property/${id}/tenant/create`)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="account-plus-outline" size={16} color="#fff" />
                <Text style={styles.addTenantBtnText}>Add Tenant</Text>
              </TouchableOpacity>
            )}
          </View>

          {tenants.length === 0 ? (
            <EmptyState
              icon="account-plus"
              title="No tenants yet"
              subtitle={isOwner ? "Tap + to add a tenant and send them an invite" : "No tenants in this property"}
              actionLabel={isOwner ? "Add Tenant" : undefined}
              onAction={isOwner ? () => router.push(`/property/${id}/tenant/create`) : undefined}
            />
          ) : (
            tenants.map((tenant) => (
              <TenantCard
                key={tenant.id}
                tenant={tenant}
                onPress={() => router.push(`/property/${id}/tenant/${tenant.id}`)}
              />
            ))
          )}
        </View>

        {/* Expenses (owner only) */}
        {isOwner && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Expenses</Text>
              <TouchableOpacity
                style={styles.addExpenseBtn}
                onPress={() => router.push(`/property/${id}/expenses/add`)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="plus" size={16} color="#fff" />
                <Text style={styles.addExpenseBtnText}>Add</Text>
              </TouchableOpacity>
            </View>

            {expenses.length === 0 ? (
              <View style={styles.expenseEmptyCard}>
                <MaterialCommunityIcons name="cash-minus" size={24} color={Colors.textDisabled} />
                <Text style={styles.expenseEmptyText}>No expenses logged yet</Text>
              </View>
            ) : (
              <>
                {expenses.slice(0, 5).map((e) => {
                  const color = getCategoryColor(e.category);
                  const icon = getCategoryIcon(e.category);
                  const label = getCategoryLabel(e.category);
                  const dateStr = new Date(e.expense_date).toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'short',
                  });

                  return (
                    <TouchableOpacity
                      key={e.id}
                      style={styles.expenseRow}
                      onPress={() => router.push(`/property/${id}/expenses/${e.id}`)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.expenseIconBox, { backgroundColor: color + '18' }]}>
                        <Icon source={icon} size={16} color={color} />
                      </View>
                      <View style={styles.expenseInfo}>
                        <Text style={styles.expenseCat}>{label}</Text>
                        {e.description ? (
                          <Text style={styles.expenseDesc} numberOfLines={1}>{e.description}</Text>
                        ) : null}
                      </View>
                      <View style={styles.expenseRight}>
                        <Text style={styles.expenseAmount}>{formatCurrency(e.amount)}</Text>
                        <Text style={styles.expenseDate}>{dateStr}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}

                {expenses.length > 5 && (
                  <TouchableOpacity
                    style={styles.viewAllBtn}
                    onPress={() => router.push(`/property/${id}/expenses`)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.viewAllText}>View all {expenses.length} expenses</Text>
                    <MaterialCommunityIcons name="chevron-right" size={16} color={Colors.primary} />
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        )}

        {property.notes ? (
          <View style={styles.notesCard}>
            <Text variant="labelMedium" style={styles.notesLabel}>Notes</Text>
            <Text variant="bodyMedium">{property.notes}</Text>
          </View>
        ) : null}

        {/* Edit & Delete buttons (owner only) */}
        {isOwner && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => router.push({ pathname: '/property/create', params: { id } })}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="pencil-outline" size={18} color={Colors.primary} />
              <Text style={styles.editBtnText}>Edit Property</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => setDeleteDialogVisible(true)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="delete-outline" size={18} color={Colors.error} />
              <Text style={styles.deleteBtnText}>Archive Property</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <ConfirmDialog
        visible={deleteDialogVisible}
        title="Archive Property"
        message={`Archive "${property.name}"? This will also archive all its tenants. This cannot be undone.`}
        confirmLabel="Archive"
        confirmColor={Colors.error}
        loading={deleting}
        onConfirm={handleArchiveProperty}
        onCancel={() => setDeleteDialogVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
  },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 12,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.border,
  },
  statValue: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.primary,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
  },
  addressText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  section: {
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  addTenantBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addTenantBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  notesCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  notesLabel: {
    color: Colors.textSecondary,
    textTransform: 'uppercase',
  },
  addExpenseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addExpenseBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  expenseEmptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  expenseEmptyText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  expenseIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseInfo: {
    flex: 1,
    gap: 1,
  },
  expenseCat: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  expenseDesc: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  expenseRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  expenseAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  expenseDate: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    paddingVertical: 12,
  },
  editBtnText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  deleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.error,
    paddingVertical: 12,
  },
  deleteBtnText: {
    color: Colors.error,
    fontWeight: '700',
    fontSize: 13,
  },
});
