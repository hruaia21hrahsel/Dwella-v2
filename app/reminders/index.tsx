import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { PaymentStatusBadge } from '@/components/PaymentStatusBadge';
import { Colors } from '@/constants/colors';
import { formatCurrency, getCurrentMonthYear } from '@/lib/utils';
import { PaymentStatus } from '@/lib/types';

interface ReminderItem {
  id: string;
  status: PaymentStatus;
  amount_due: number;
  amount_paid: number;
  due_date: string;
  month: number;
  year: number;
  tenants: {
    id: string;
    tenant_name: string;
    flat_no: string;
    user_id: string | null;
    properties: {
      id: string;
      name: string;
      owner_id: string;
    };
  };
}

export default function RemindersScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [eligible, setEligible] = useState<ReminderItem[]>([]);
  const [unlinked, setUnlinked] = useState<ReminderItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const { month: currentMonth, year: currentYear } = getCurrentMonthYear();

  useEffect(() => {
    fetchEligible();
  }, []);

  async function fetchEligible() {
    if (!user) return;
    setIsLoading(true);

    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('payments')
      .select(`
        id, status, amount_due, amount_paid, due_date, month, year,
        tenants (
          id, tenant_name, flat_no, due_day, user_id, is_archived, invite_status,
          properties ( id, name, owner_id )
        )
      `)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .in('status', ['pending', 'partial', 'overdue'])
      .lte('due_date', today);

    if (error) {
      console.error('Reminders fetch error:', error);
      setIsLoading(false);
      return;
    }

    // Filter: only this landlord's tenants, not archived, invite accepted
    const items = (data ?? []).filter((item: any) => {
      const t = item.tenants;
      if (!t) return false;
      if (t.is_archived) return false;
      if (t.invite_status !== 'accepted') return false;
      if (!t.properties) return false;
      if (t.properties.owner_id !== user.id) return false;
      return true;
    }) as unknown as ReminderItem[];

    setEligible(items.filter((i) => i.tenants.user_id !== null));
    setUnlinked(items.filter((i) => i.tenants.user_id === null));
    setIsLoading(false);
  }

  async function handleSend() {
    if (eligible.length === 0) return;
    setIsSending(true);

    const notifications = eligible.map((item) => ({
      user_id: item.tenants.user_id!,
      tenant_id: item.tenants.id,
      payment_id: item.id,
      type: item.status === 'overdue' ? 'payment_overdue' : 'payment_reminder',
      title: item.status === 'overdue' ? 'Payment Overdue' : 'Payment Due',
      body:
        item.status === 'overdue'
          ? `Your rent of ${formatCurrency(item.amount_due)} for ${item.tenants.properties.name} (Flat ${item.tenants.flat_no}) is overdue. Please pay immediately.`
          : `Your rent of ${formatCurrency(item.amount_due)} for ${item.tenants.properties.name} (Flat ${item.tenants.flat_no}) is due today. Please make your payment.`,
    }));

    const { error } = await supabase.from('notifications').insert(notifications);
    setIsSending(false);

    if (error) {
      Alert.alert('Error', 'Failed to send reminders. Please try again.');
      return;
    }

    Alert.alert(
      'Reminders Sent',
      `Reminders sent to ${eligible.length} tenant${eligible.length === 1 ? '' : 's'}.`,
      [{ text: 'OK', onPress: () => router.back() }],
    );
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  const allEmpty = eligible.length === 0 && unlinked.length === 0;

  return (
    <View style={styles.container}>
      {/* Summary banner */}
      <View style={styles.banner}>
        <Text style={styles.bannerText}>
          {eligible.length > 0
            ? `${eligible.length} tenant${eligible.length === 1 ? '' : 's'} will be notified`
            : 'No tenants due today'}
          {unlinked.length > 0 ? ` · ${unlinked.length} not linked` : ''}
        </Text>
      </View>

      <FlatList
        data={eligible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <MaterialCommunityIcons
              name="bell-check-outline"
              size={48}
              color={Colors.textDisabled}
            />
            <Text style={styles.emptyTitle}>No tenants due today</Text>
            <Text style={styles.emptySub}>
              All tenants are either paid up or not yet due.
            </Text>
          </View>
        }
        ListFooterComponent={
          unlinked.length > 0 ? (
            <View style={styles.unlinkedSection}>
              <Text style={styles.unlinkedHeader}>
                <MaterialCommunityIcons
                  name="alert-circle-outline"
                  size={14}
                  color={Colors.textSecondary}
                />{' '}
                Not linked — won't receive reminders
              </Text>
              {unlinked.map((item) => (
                <View key={item.id} style={styles.unlinkedRow}>
                  <Text style={styles.unlinkedName}>
                    {item.tenants.tenant_name} · Flat {item.tenants.flat_no}
                  </Text>
                  <Text style={styles.unlinkedProp}>{item.tenants.properties.name}</Text>
                </View>
              ))}
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const remaining = item.amount_due - item.amount_paid;
          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.cardLeft}>
                  <Text style={styles.tenantName}>
                    {item.tenants.tenant_name} · Flat {item.tenants.flat_no}
                  </Text>
                  <Text style={styles.propName}>{item.tenants.properties.name}</Text>
                </View>
                <PaymentStatusBadge status={item.status} />
              </View>
              <View style={styles.cardBottom}>
                <Text style={styles.amountLabel}>Due</Text>
                <Text style={styles.amountValue}>{formatCurrency(item.amount_due)}</Text>
                {item.amount_paid > 0 && (
                  <>
                    <Text style={[styles.amountLabel, { marginLeft: 16 }]}>Remaining</Text>
                    <Text style={[styles.amountValue, { color: Colors.statusOverdue }]}>
                      {formatCurrency(remaining)}
                    </Text>
                  </>
                )}
              </View>
            </View>
          );
        }}
      />

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.sendBtn,
            (eligible.length === 0 || isSending) && styles.sendBtnDisabled,
          ]}
          onPress={handleSend}
          disabled={eligible.length === 0 || isSending}
          activeOpacity={0.8}
        >
          {isSending ? (
            <ActivityIndicator color="#fff" size="small" style={{ marginRight: 8 }} />
          ) : (
            <MaterialCommunityIcons
              name="bell-ring-outline"
              size={18}
              color="#fff"
              style={{ marginRight: 8 }}
            />
          )}
          <Text style={styles.sendBtnText}>
            {isSending
              ? 'Sending…'
              : eligible.length === 0
              ? 'No Tenants Due'
              : `Send to ${eligible.length} Tenant${eligible.length === 1 ? '' : 's'}`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  banner: {
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  bannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  listContent: {
    padding: 16,
    paddingBottom: 8,
    flexGrow: 1,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardLeft: {
    flex: 1,
    marginRight: 12,
  },
  tenantName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  propName: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginRight: 4,
  },
  amountValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    color: Colors.textDisabled,
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  unlinkedSection: {
    marginTop: 8,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: Colors.warning,
  },
  unlinkedHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  unlinkedRow: {
    marginBottom: 8,
  },
  unlinkedName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  unlinkedProp: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  footer: {
    padding: 16,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
  },
  sendBtnDisabled: {
    backgroundColor: Colors.textDisabled,
  },
  sendBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
