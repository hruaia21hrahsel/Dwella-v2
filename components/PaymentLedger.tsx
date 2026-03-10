import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Button, Divider, ActivityIndicator } from 'react-native-paper';
import { Payment } from '@/lib/types';
import { PaymentStatusBadge } from './PaymentStatusBadge';
import { EmptyState } from './EmptyState';
import { useTheme } from '@/lib/theme-context';
import { formatCurrency, getMonthName } from '@/lib/utils';
import { canMarkAsPaid, canConfirm } from '@/lib/payments';

interface PaymentLedgerProps {
  payments: Payment[];
  isLoading: boolean;
  isOwner: boolean;
  onPressRow: (payment: Payment) => void;
  onMarkPaid: (payment: Payment) => void;
  onConfirm: (payment: Payment) => void;
  onLogPayment?: (payment: Payment) => void;
}

function PaymentRow({
  payment,
  isOwner,
  onPress,
  onMarkPaid,
  onConfirm,
  onLogPayment,
}: {
  payment: Payment;
  isOwner: boolean;
  onPress: () => void;
  onMarkPaid: () => void;
  onConfirm: () => void;
  onLogPayment?: () => void;
}) {
  const { colors } = useTheme();
  const isTenant = !isOwner;
  const showMarkPaid = isTenant && canMarkAsPaid(payment.status);
  const showLogPayment = isOwner && onLogPayment && canMarkAsPaid(payment.status);
  const showConfirm = isOwner && canConfirm(payment.status);

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.6}>
      <View style={styles.rowLeft}>
        <Text style={[styles.monthLabel, { color: colors.textPrimary }]}>
          {getMonthName(payment.month)} {payment.year}
        </Text>
        <View style={styles.amountsRow}>
          <Text style={[styles.amountText, { color: colors.textSecondary }]}>
            {formatCurrency(payment.amount_due)}
          </Text>
          {payment.amount_paid > 0 && (
            <Text style={[styles.amountText, { color: colors.statusConfirmed }]}>
              · {formatCurrency(payment.amount_paid)} paid
            </Text>
          )}
        </View>
      </View>

      <View style={styles.rowRight}>
        <PaymentStatusBadge status={payment.status} />
        {showMarkPaid && (
          <Button mode="contained" compact onPress={(e) => { e.stopPropagation?.(); onMarkPaid(); }} style={styles.actionBtn}>
            Pay
          </Button>
        )}
        {showLogPayment && (
          <Button mode="contained" compact onPress={(e) => { e.stopPropagation?.(); onLogPayment!(); }} style={styles.actionBtn}>
            Log
          </Button>
        )}
        {showConfirm && (
          <Button
            mode="contained"
            compact
            onPress={(e) => { e.stopPropagation?.(); onConfirm(); }}
            style={styles.actionBtn}
            buttonColor={colors.statusConfirmed}
          >
            Confirm
          </Button>
        )}
      </View>
    </TouchableOpacity>
  );
}

export function PaymentLedger({
  payments,
  isLoading,
  isOwner,
  onPressRow,
  onMarkPaid,
  onConfirm,
  onLogPayment,
}: PaymentLedgerProps) {
  const { colors } = useTheme();

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (payments.length === 0) {
    return (
      <EmptyState
        icon="receipt"
        title="No payment records"
        subtitle="Payment rows will appear here each month."
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {payments.map((payment, index) => (
        <View key={payment.id}>
          <PaymentRow
            payment={payment}
            isOwner={isOwner}
            onPress={() => onPressRow(payment)}
            onMarkPaid={() => onMarkPaid(payment)}
            onConfirm={() => onConfirm(payment)}
            onLogPayment={onLogPayment ? () => onLogPayment(payment) : undefined}
          />
          {index < payments.length - 1 && <Divider />}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 14,
    gap: 10,
  },
  rowLeft: {
    flex: 1,
    gap: 3,
  },
  monthLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  amountsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  amountText: {
    fontSize: 12,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    minWidth: 64,
  },
  centered: {
    padding: 32,
    alignItems: 'center',
  },
});
