import { useState, useEffect, useCallback } from 'react';
import { ScrollView, View, StyleSheet, TouchableOpacity, TextInput as RNTextInput } from 'react-native';
import { Text, ActivityIndicator, Button } from 'react-native-paper';
import { Stack } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '@/lib/store';
import { useToastStore } from '@/lib/toast';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme-context';
import { AnimatedCard } from '@/components/AnimatedCard';
import { PaymentStatusBadge } from '@/components/PaymentStatusBadge';
import { formatCurrency } from '@/lib/utils';
import { useTrack, EVENTS } from '@/lib/analytics';
import type { PaymentStatus } from '@/lib/types';

interface ReminderDraft {
  tenant_id: string;
  tenant_name: string;
  flat_no: string;
  property_name: string;
  status: string;
  amount_due: number;
  amount_paid: number;
  can_notify: boolean;
  draft_message: string;
}

const FUNCTION_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ai-draft-reminders`;

export default function SmartRemindersScreen() {
  const { user } = useAuthStore();
  const { colors, shadows } = useTheme();
  const track = useTrack();
  const [reminders, setReminders] = useState<ReminderDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [sendingId, setSendingId] = useState<string | null>(null);

  const fetchReminders = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ user_id: user.id }),
      });

      if (!res.ok) throw new Error(`Error: ${res.status}`);
      const result = await res.json();
      setReminders(result.reminders ?? []);
      track(EVENTS.AI_REMINDERS_DRAFTED, { count: (result.reminders ?? []).length });
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  const handleEdit = (reminder: ReminderDraft) => {
    setEditingId(reminder.tenant_id);
    setEditText(reminder.draft_message);
  };

  const handleSaveEdit = (tenantId: string) => {
    setReminders((prev) =>
      prev.map((r) => r.tenant_id === tenantId ? { ...r, draft_message: editText } : r)
    );
    setEditingId(null);
  };

  const handleSend = async (reminder: ReminderDraft) => {
    if (!reminder.can_notify) {
      useToastStore.getState().showToast(
        `${reminder.tenant_name} hasn't accepted their invite yet`,
        'error'
      );
      return;
    }

    setSendingId(reminder.tenant_id);
    try {
      // Find the tenant's user_id to send notification
      const { data: tenant } = await supabase
        .from('tenants')
        .select('user_id')
        .eq('id', reminder.tenant_id)
        .single();

      if (!tenant?.user_id) throw new Error('Tenant has no linked user');

      const { error } = await supabase.from('notifications').insert({
        user_id: tenant.user_id,
        tenant_id: reminder.tenant_id,
        type: 'reminder',
        title: 'Rent Reminder',
        body: reminder.draft_message,
      });

      if (error) throw error;
      useToastStore.getState().showToast(`Reminder sent to ${reminder.tenant_name}!`, 'success');

      // Remove sent reminder from list
      setReminders((prev) => prev.filter((r) => r.tenant_id !== reminder.tenant_id));
    } catch (err) {
      useToastStore.getState().showToast(String(err), 'error');
    } finally {
      setSendingId(null);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Smart Reminders' }} />
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <MaterialCommunityIcons name="robot-outline" size={20} color={colors.primary} />
          <Text style={[styles.headerText, { color: colors.textSecondary }]}>
            AI-drafted reminders for tenants with outstanding payments
          </Text>
        </View>

        {loading && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Drafting personalized reminders...</Text>
          </View>
        )}

        {error && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.error }]}>
            <Text style={{ color: colors.error }}>{error}</Text>
            <TouchableOpacity onPress={fetchReminders} style={styles.retryBtn}>
              <Text style={{ color: colors.primary, fontWeight: '600' }}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !error && reminders.length === 0 && (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface }]}>
            <MaterialCommunityIcons name="check-circle-outline" size={40} color={colors.statusConfirmed} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>All caught up!</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>No tenants need reminders right now.</Text>
          </View>
        )}

        {reminders.map((reminder, index) => (
          <AnimatedCard key={reminder.tenant_id} index={index}>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, shadows.sm]}>
              {/* Header */}
              <View style={styles.cardHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.tenantName, { color: colors.textPrimary }]}>{reminder.tenant_name}</Text>
                  <Text style={[styles.tenantSub, { color: colors.textSecondary }]}>
                    Flat {reminder.flat_no} · {reminder.property_name}
                  </Text>
                </View>
                <PaymentStatusBadge status={reminder.status as PaymentStatus} />
              </View>

              {/* Amount info */}
              <View style={styles.amountRow}>
                <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>
                  Balance: <Text style={{ color: colors.statusOverdue, fontWeight: '700' }}>
                    {formatCurrency(reminder.amount_due - reminder.amount_paid)}
                  </Text>
                </Text>
              </View>

              {/* Draft message */}
              {editingId === reminder.tenant_id ? (
                <View style={styles.editWrap}>
                  <RNTextInput
                    value={editText}
                    onChangeText={setEditText}
                    style={[styles.editInput, { backgroundColor: colors.primarySoft, color: colors.textPrimary }]}
                    multiline
                    autoFocus
                  />
                  <View style={styles.editActions}>
                    <TouchableOpacity onPress={() => setEditingId(null)}>
                      <Text style={{ color: colors.textSecondary }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleSaveEdit(reminder.tenant_id)}>
                      <Text style={{ color: colors.primary, fontWeight: '600' }}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity onPress={() => handleEdit(reminder)} style={[styles.messageWrap, { backgroundColor: colors.primarySoft }]}>
                  <Text style={[styles.messageText, { color: colors.textPrimary }]}>{reminder.draft_message}</Text>
                  <MaterialCommunityIcons
                    name="pencil-outline"
                    size={14}
                    color={colors.textDisabled}
                    style={styles.editIcon}
                  />
                </TouchableOpacity>
              )}

              {/* Send button */}
              <Button
                mode="contained"
                icon="send"
                onPress={() => handleSend(reminder)}
                loading={sendingId === reminder.tenant_id}
                disabled={sendingId === reminder.tenant_id || !reminder.can_notify}
                buttonColor={colors.primary}
                style={styles.sendBtn}
                compact
              >
                {reminder.can_notify ? 'Send Reminder' : 'Invite Not Accepted'}
              </Button>
            </View>
          </AnimatedCard>
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  centered: { alignItems: 'center', paddingVertical: 40 },
  loadingText: { marginTop: 12, fontSize: 14 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  headerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tenantName: {
    fontSize: 15,
    fontWeight: '700',
  },
  tenantSub: {
    fontSize: 12,
    marginTop: 2,
  },
  amountRow: {
    marginBottom: 10,
  },
  amountLabel: {
    fontSize: 13,
  },
  messageWrap: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    position: 'relative',
  },
  messageText: {
    fontSize: 13,
    lineHeight: 19,
    paddingRight: 20,
  },
  editIcon: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  editWrap: {
    marginBottom: 10,
  },
  editInput: {
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    lineHeight: 19,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    marginTop: 8,
  },
  sendBtn: {
    borderRadius: 10,
  },
  retryBtn: {
    marginTop: 8,
    alignSelf: 'center',
  },
  emptyCard: {
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 13,
  },
});
