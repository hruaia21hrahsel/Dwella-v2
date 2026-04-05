import { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text, TextInput, HelperText } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/lib/theme-context';
import { formatCurrency } from '@/lib/utils';

interface YearRow {
  year: number;
  principalPaid: number;
  interestPaid: number;
  balance: number;
}

interface EmiResult {
  monthlyEmi: number;
  totalInterest: number;
  totalPayable: number;
  principalPct: number;
  interestPct: number;
  yearly: YearRow[];
}

function calculateEmi(principal: number, annualRate: number, years: number): EmiResult | null {
  if (principal <= 0 || years <= 0) return null;

  const months = Math.round(years * 12);
  const monthlyRate = annualRate / 12 / 100;

  let monthlyEmi: number;
  if (monthlyRate === 0) {
    monthlyEmi = principal / months;
  } else {
    const pow = Math.pow(1 + monthlyRate, months);
    monthlyEmi = (principal * monthlyRate * pow) / (pow - 1);
  }

  const totalPayable = monthlyEmi * months;
  const totalInterest = totalPayable - principal;

  // Year-wise amortization
  const yearly: YearRow[] = [];
  let balance = principal;
  for (let y = 1; y <= Math.ceil(years); y++) {
    let principalPaidYear = 0;
    let interestPaidYear = 0;
    const monthsThisYear = Math.min(12, months - (y - 1) * 12);
    for (let m = 0; m < monthsThisYear; m++) {
      const interest = balance * monthlyRate;
      const principalComponent = monthlyEmi - interest;
      principalPaidYear += principalComponent;
      interestPaidYear += interest;
      balance -= principalComponent;
    }
    yearly.push({
      year: y,
      principalPaid: principalPaidYear,
      interestPaid: interestPaidYear,
      balance: Math.max(0, balance),
    });
    if (balance <= 0) break;
  }

  const principalPct = (principal / totalPayable) * 100;
  const interestPct = (totalInterest / totalPayable) * 100;

  return { monthlyEmi, totalInterest, totalPayable, principalPct, interestPct, yearly };
}

export default function EmiCalculatorScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, shadows } = useTheme();

  const [principalStr, setPrincipalStr] = useState('5000000');
  const [rateStr, setRateStr] = useState('8.5');
  const [yearsStr, setYearsStr] = useState('20');
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const principal = parseFloat(principalStr) || 0;
  const rate = parseFloat(rateStr) || 0;
  const years = parseFloat(yearsStr) || 0;

  const result = useMemo(() => calculateEmi(principal, rate, years), [principal, rate, years]);

  const principalValid = principal > 0;
  const rateValid = rate >= 0 && rate <= 50;
  const yearsValid = years > 0 && years <= 40;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Top bar */}
      <LinearGradient
        colors={[colors.surface, colors.primarySoft]}
        start={{ x: 0.35, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.topBar, { paddingTop: insets.top, shadowColor: colors.primary }]}
      >
        <TouchableOpacity style={styles.topBarBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text variant="titleMedium" style={[styles.topBarTitle, { color: colors.textPrimary }]}>
          EMI Calculator
        </Text>
        <View style={styles.topBarBtn} />
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Inputs card */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Loan Details</Text>

          <TextInput
            label="Loan amount (₹)"
            value={principalStr}
            onChangeText={setPrincipalStr}
            keyboardType="numeric"
            mode="outlined"
            style={styles.input}
            left={<TextInput.Icon icon="currency-inr" />}
          />
          {!principalValid && principalStr.length > 0 && (
            <HelperText type="error" visible>Enter a valid loan amount</HelperText>
          )}

          <TextInput
            label="Interest rate (% per year)"
            value={rateStr}
            onChangeText={setRateStr}
            keyboardType="numeric"
            mode="outlined"
            style={styles.input}
            left={<TextInput.Icon icon="percent" />}
          />
          {!rateValid && rateStr.length > 0 && (
            <HelperText type="error" visible>Rate must be between 0 and 50</HelperText>
          )}

          <TextInput
            label="Tenure (years)"
            value={yearsStr}
            onChangeText={setYearsStr}
            keyboardType="numeric"
            mode="outlined"
            style={styles.input}
            left={<TextInput.Icon icon="calendar-range" />}
          />
          {!yearsValid && yearsStr.length > 0 && (
            <HelperText type="error" visible>Tenure must be between 1 and 40 years</HelperText>
          )}
        </View>

        {/* Results */}
        {result && principalValid && rateValid && yearsValid && (
          <>
            <View style={[styles.emiHero, { backgroundColor: colors.primary, ...shadows.md }]}>
              <Text style={[styles.emiHeroLabel, { color: colors.textOnPrimary }]}>Monthly EMI</Text>
              <Text style={[styles.emiHeroValue, { color: colors.textOnPrimary }]}>
                {formatCurrency(Math.round(result.monthlyEmi))}
              </Text>
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Breakdown</Text>

              <View style={styles.breakdownRow}>
                <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Principal</Text>
                <Text style={[styles.breakdownValue, { color: colors.textPrimary }]}>
                  {formatCurrency(Math.round(principal))}
                </Text>
              </View>

              <View style={styles.breakdownRow}>
                <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Total interest</Text>
                <Text style={[styles.breakdownValue, { color: colors.statusOverdue }]}>
                  {formatCurrency(Math.round(result.totalInterest))}
                </Text>
              </View>

              <View style={[styles.breakdownRow, styles.breakdownTotal, { borderTopColor: colors.border }]}>
                <Text style={[styles.breakdownLabel, { color: colors.textPrimary, fontWeight: '700' }]}>
                  Total payable
                </Text>
                <Text style={[styles.breakdownValue, { color: colors.textPrimary, fontWeight: '700' }]}>
                  {formatCurrency(Math.round(result.totalPayable))}
                </Text>
              </View>

              {/* Visual proportion bar */}
              <View style={[styles.proportionBar, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.proportionFill,
                    { backgroundColor: colors.primary, flex: result.principalPct },
                  ]}
                />
                <View
                  style={[
                    styles.proportionFill,
                    { backgroundColor: colors.statusOverdue, flex: result.interestPct },
                  ]}
                />
              </View>
              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
                  <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                    Principal {result.principalPct.toFixed(1)}%
                  </Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.statusOverdue }]} />
                  <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                    Interest {result.interestPct.toFixed(1)}%
                  </Text>
                </View>
              </View>
            </View>

            {/* Year-wise amortization (collapsible) */}
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              activeOpacity={0.7}
              onPress={() => setScheduleOpen((prev) => !prev)}
            >
              <View style={styles.scheduleHeader}>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginBottom: 0 }]}>
                  Year-wise Schedule
                </Text>
                <MaterialCommunityIcons
                  name={scheduleOpen ? 'chevron-up' : 'chevron-down'}
                  size={22}
                  color={colors.textSecondary}
                />
              </View>

              {scheduleOpen && (
                <View style={styles.table}>
                  <View style={[styles.tableHeaderRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.tableHeaderCell, styles.colYear, { color: colors.textSecondary }]}>Year</Text>
                    <Text style={[styles.tableHeaderCell, styles.colValue, { color: colors.textSecondary }]}>Principal</Text>
                    <Text style={[styles.tableHeaderCell, styles.colValue, { color: colors.textSecondary }]}>Interest</Text>
                    <Text style={[styles.tableHeaderCell, styles.colValue, { color: colors.textSecondary }]}>Balance</Text>
                  </View>
                  {result.yearly.map((row) => (
                    <View
                      key={row.year}
                      style={[styles.tableRow, { borderBottomColor: colors.border }]}
                    >
                      <Text style={[styles.tableCell, styles.colYear, { color: colors.textPrimary }]}>
                        {row.year}
                      </Text>
                      <Text style={[styles.tableCell, styles.colValue, { color: colors.textPrimary }]}>
                        {formatCurrency(Math.round(row.principalPaid))}
                      </Text>
                      <Text style={[styles.tableCell, styles.colValue, { color: colors.statusOverdue }]}>
                        {formatCurrency(Math.round(row.interestPaid))}
                      </Text>
                      <Text style={[styles.tableCell, styles.colValue, { color: colors.textPrimary }]}>
                        {formatCurrency(Math.round(row.balance))}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>

            <Text style={[styles.disclaimer, { color: colors.textDisabled }]}>
              Indicative figures based on constant interest rate. Actual EMI may vary based on your lender's schedule.
            </Text>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 6,
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 10,
    elevation: 3,
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
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  input: {
    marginBottom: 4,
  },
  emiHero: {
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
  },
  emiHeroLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.85,
  },
  emiHeroValue: {
    fontSize: 32,
    fontWeight: '800',
    marginTop: 4,
    letterSpacing: -0.5,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  breakdownTotal: {
    borderTopWidth: 1,
    marginTop: 4,
    paddingTop: 12,
  },
  breakdownLabel: {
    fontSize: 14,
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  proportionBar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    marginTop: 16,
  },
  proportionFill: {
    height: '100%',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '500',
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  table: {
    marginTop: 12,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  tableHeaderCell: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  tableCell: {
    fontSize: 12,
    fontWeight: '500',
  },
  colYear: {
    width: 36,
  },
  colValue: {
    flex: 1,
    textAlign: 'right',
  },
  disclaimer: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 16,
    lineHeight: 16,
  },
});
