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

interface YieldResult {
  grossAnnualRent: number;
  effectiveAnnualRent: number;
  annualExpenses: number;
  annualCashFlow: number;
  grossYield: number;
  netYield: number;
  verdict: { label: string; color: 'good' | 'ok' | 'low' };
}

function classifyYield(netYield: number): YieldResult['verdict'] {
  if (netYield >= 6) return { label: 'Strong', color: 'good' };
  if (netYield >= 3) return { label: 'Average', color: 'ok' };
  return { label: 'Below market', color: 'low' };
}

function calculateYield(
  propertyValue: number,
  monthlyRent: number,
  annualExpenses: number,
  vacancyPct: number
): YieldResult | null {
  if (propertyValue <= 0 || monthlyRent < 0) return null;

  const grossAnnualRent = monthlyRent * 12;
  const effectiveAnnualRent = grossAnnualRent * (1 - vacancyPct / 100);
  const annualCashFlow = effectiveAnnualRent - annualExpenses;

  const grossYield = (grossAnnualRent / propertyValue) * 100;
  const netYield = (annualCashFlow / propertyValue) * 100;

  return {
    grossAnnualRent,
    effectiveAnnualRent,
    annualExpenses,
    annualCashFlow,
    grossYield,
    netYield,
    verdict: classifyYield(netYield),
  };
}

export default function RentalYieldScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, shadows } = useTheme();

  const [valueStr, setValueStr] = useState('10000000');
  const [rentStr, setRentStr] = useState('35000');
  const [expensesStr, setExpensesStr] = useState('60000');
  const [vacancyStr, setVacancyStr] = useState('5');

  const propertyValue = parseFloat(valueStr) || 0;
  const monthlyRent = parseFloat(rentStr) || 0;
  const annualExpenses = parseFloat(expensesStr) || 0;
  const vacancy = parseFloat(vacancyStr) || 0;

  const result = useMemo(
    () => calculateYield(propertyValue, monthlyRent, annualExpenses, vacancy),
    [propertyValue, monthlyRent, annualExpenses, vacancy]
  );

  const valueValid = propertyValue > 0;
  const rentValid = monthlyRent >= 0;
  const vacancyValid = vacancy >= 0 && vacancy <= 100;

  const verdictColor =
    result?.verdict.color === 'good'
      ? colors.success
      : result?.verdict.color === 'ok'
        ? colors.statusPartial
        : colors.statusOverdue;

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
          Rental Yield
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
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Property Details</Text>

          <TextInput
            label="Property value (₹)"
            value={valueStr}
            onChangeText={setValueStr}
            keyboardType="numeric"
            mode="outlined"
            style={styles.input}
            left={<TextInput.Icon icon="home-city" />}
          />
          {!valueValid && valueStr.length > 0 && (
            <HelperText type="error" visible>Enter a valid property value</HelperText>
          )}

          <TextInput
            label="Monthly rent (₹)"
            value={rentStr}
            onChangeText={setRentStr}
            keyboardType="numeric"
            mode="outlined"
            style={styles.input}
            left={<TextInput.Icon icon="cash" />}
          />
          {!rentValid && rentStr.length > 0 && (
            <HelperText type="error" visible>Enter a valid rent amount</HelperText>
          )}

          <TextInput
            label="Annual expenses (₹)"
            value={expensesStr}
            onChangeText={setExpensesStr}
            keyboardType="numeric"
            mode="outlined"
            style={styles.input}
            left={<TextInput.Icon icon="wrench" />}
          />
          <Text style={[styles.inputHint, { color: colors.textDisabled }]}>
            Property tax, maintenance, insurance, repairs
          </Text>

          <TextInput
            label="Vacancy rate (%)"
            value={vacancyStr}
            onChangeText={setVacancyStr}
            keyboardType="numeric"
            mode="outlined"
            style={[styles.input, { marginTop: 8 }]}
            left={<TextInput.Icon icon="home-outline" />}
          />
          {!vacancyValid && vacancyStr.length > 0 && (
            <HelperText type="error" visible>Vacancy must be between 0 and 100</HelperText>
          )}
        </View>

        {/* Results */}
        {result && valueValid && rentValid && vacancyValid && (
          <>
            <View style={[styles.heroCard, { backgroundColor: colors.primary, ...shadows.md }]}>
              <View style={styles.heroGrid}>
                <View style={styles.heroItem}>
                  <Text style={[styles.heroLabel, { color: colors.textOnPrimary }]}>Gross Yield</Text>
                  <Text style={[styles.heroValue, { color: colors.textOnPrimary }]}>
                    {result.grossYield.toFixed(2)}%
                  </Text>
                </View>
                <View style={[styles.heroDivider, { backgroundColor: colors.textOnPrimary }]} />
                <View style={styles.heroItem}>
                  <Text style={[styles.heroLabel, { color: colors.textOnPrimary }]}>Net Yield</Text>
                  <Text style={[styles.heroValue, { color: colors.textOnPrimary }]}>
                    {result.netYield.toFixed(2)}%
                  </Text>
                </View>
              </View>
              <View style={[styles.verdictPill, { backgroundColor: verdictColor }]}>
                <Text style={styles.verdictText}>{result.verdict.label}</Text>
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Annual Breakdown</Text>

              <View style={styles.row}>
                <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>Gross rent (12 months)</Text>
                <Text style={[styles.rowValue, { color: colors.textPrimary }]}>
                  {formatCurrency(Math.round(result.grossAnnualRent))}
                </Text>
              </View>

              {vacancy > 0 && (
                <View style={styles.row}>
                  <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>
                    Less: vacancy ({vacancy}%)
                  </Text>
                  <Text style={[styles.rowValue, { color: colors.statusOverdue }]}>
                    −{formatCurrency(Math.round(result.grossAnnualRent - result.effectiveAnnualRent))}
                  </Text>
                </View>
              )}

              <View style={styles.row}>
                <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>Effective rent</Text>
                <Text style={[styles.rowValue, { color: colors.textPrimary }]}>
                  {formatCurrency(Math.round(result.effectiveAnnualRent))}
                </Text>
              </View>

              <View style={styles.row}>
                <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>Less: expenses</Text>
                <Text style={[styles.rowValue, { color: colors.statusOverdue }]}>
                  −{formatCurrency(Math.round(result.annualExpenses))}
                </Text>
              </View>

              <View style={[styles.row, styles.rowTotal, { borderTopColor: colors.border }]}>
                <Text style={[styles.rowLabel, { color: colors.textPrimary, fontWeight: '700' }]}>
                  Annual cash flow
                </Text>
                <Text
                  style={[
                    styles.rowValue,
                    {
                      color: result.annualCashFlow >= 0 ? colors.success : colors.statusOverdue,
                      fontWeight: '700',
                    },
                  ]}
                >
                  {formatCurrency(Math.round(result.annualCashFlow))}
                </Text>
              </View>
            </View>

            <View style={[styles.infoCard, { backgroundColor: colors.primarySoft }]}>
              <MaterialCommunityIcons
                name="information-outline"
                size={18}
                color={colors.primary}
                style={{ marginTop: 2 }}
              />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.infoTitle, { color: colors.primary }]}>Benchmark</Text>
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                  Typical net yield for Indian residential is 2–4%. 5%+ is strong. Commercial often
                  runs 6–10%. Compare against safe returns (FD, debt) before deciding.
                </Text>
              </View>
            </View>
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
  inputHint: {
    fontSize: 11,
    marginTop: 2,
    marginLeft: 4,
  },
  heroCard: {
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
  },
  heroGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  heroItem: {
    flex: 1,
    alignItems: 'center',
  },
  heroDivider: {
    width: 1,
    height: 40,
    opacity: 0.2,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.85,
  },
  heroValue: {
    fontSize: 28,
    fontWeight: '800',
    marginTop: 4,
    letterSpacing: -0.5,
  },
  verdictPill: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
  },
  verdictText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  rowTotal: {
    borderTopWidth: 1,
    marginTop: 4,
    paddingTop: 12,
  },
  rowLabel: {
    fontSize: 14,
    flex: 1,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoCard: {
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  infoText: {
    fontSize: 12,
    lineHeight: 18,
  },
});
