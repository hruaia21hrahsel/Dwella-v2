import { View, StyleSheet, FlatList } from 'react-native';
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
  onExportReceipt?: (payment: Payment) => void;
  onLogPayment?: (payment: Payment) => void;
}

function PaymentRow({
  payment,
  isOwner,
  onPress,
  onMarkPaid,
  onConfirm,
  onExportReceipt,
  onLogPayment,
}: {
  payment: Payment;
  isOwner: boolean;
  onPress: () => void;
  onMarkPaid: () => void;
  onConfirm: () => void;
  onExportReceipt?: () => void;
  onLogPayment?: () => void;
}) {
  const { colors } = useTheme();
  const isTenant = !isOwner;
  const showMarkPaid = isTenant && canMarkAsPaid(payment.status);
  const showLogPayment = isOwner && onLogPayment && canMarkAsPaid(payment.status);
  const showConfirm = isOwner && canConfirm(payment.status);
  const showReceipt = onExportReceipt && (payment.status === 'paid' || payment.status === 'confirmed');

  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text variant="titleSmall" style={[styles.monthLabel, { color: colors.textPrimary }]}>
          {getMonthName(payment.month)} {payment.year}
        </Text>
        <View style={styles.amountsRow}>
          <Text variant="bodySmall" style={{ color: colors.textSecondary }}>
            Due: {formatCurrency(payment.amount_due)}
          </Text>
          {payment.amount_paid > 0 && (
            <Text variant="bodySmall" style={{ color: colors.statusConfirmed }}>
              · Paid: {formatCurrency(payment.amount_paid)}
            </Text>
          )}
        </View>
        <PaymentStatusBadge status={payment.status} />
      </View>

      <View style={styles.rowRight}>
        {showMarkPaid && (
          <Button mode="contained" compact onPress={onMarkPaid} style={styles.actionBtn}>
            Pay
          </Button>
        )}
        {showLogPayment && (
          <Button mode="contained" compact onPress={onLogPayment} style={styles.actionBtn}>
            Log
          </Button>
        )}
        {showConfirm && (
          <Button
            mode="contained"
            compact
            onPress={onConfirm}
            style={[styles.actionBtn, styles.confirmBtn]}
            buttonColor={colors.statusConfirmed}
          >
            Confirm
          </Button>
        )}
        {showReceipt && (
          <Button mode="text" compact onPress={onExportReceipt} textColor={colors.primary} icon="file-pdf-box">
            PDF
          </Button>
        )}
        <Button mode="text" compact onPress={onPress} textColor={colors.textSecondary}>
          View
        </Button>
      </View>
    </View>
  );
}

export function PaymentLedger({
  payments,
  isLoading,
  isOwner,
  onPressRow,
  onMarkPaid,
  onConfirm,
  onExportReceipt,
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
            onExportReceipt={onExportReceipt ? () => onExportReceipt(payment) : undefined}
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
    padding: 14,
    gap: 8,
  },
  rowLeft: {
    flex: 1,
    gap: 8,
  },
  monthLabel: {
    fontWeight: '600',
  },
  amountsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionBtn: {
    minWidth: 60,
  },
  confirmBtn: {
    minWidth: 70,
  },
  centered: {
    padding: 32,
    alignItems: 'center',
  },
});
