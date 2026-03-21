import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme-context';
import { TimePeriod, Granularity } from '@/lib/reports';
import { getMonthName } from '@/lib/utils';

interface TimeControlBarProps {
  period: TimePeriod;
  onPeriodChange: (period: TimePeriod) => void;
  /** When true, only show the year picker — hide granularity and period chips. */
  yearOnly?: boolean;
}

const GRANULARITY_LABELS: { key: Granularity; label: string }[] = [
  { key: 'yearly', label: 'Yearly' },
  { key: 'quarterly', label: 'Quarterly' },
  { key: 'monthly', label: 'Monthly' },
];

const QUARTERS = [1, 2, 3, 4] as const;
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

const MIN_YEAR = 2000;

/** Indian FY quarter: Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar. */
function getCurrentQuarter(): 1 | 2 | 3 | 4 {
  const m = new Date().getMonth() + 1; // 1-12
  if (m >= 4 && m <= 6) return 1;
  if (m >= 7 && m <= 9) return 2;
  if (m >= 10 && m <= 12) return 3;
  return 4; // Jan-Mar
}

export function TimeControlBar({ period, onPeriodChange, yearOnly = false }: TimeControlBarProps) {
  const { colors } = useTheme();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  function handleYearDecrement() {
    if (period.year > MIN_YEAR) {
      onPeriodChange({ ...period, year: period.year - 1 });
    }
  }

  function handleYearIncrement() {
    if (period.year < currentYear) {
      onPeriodChange({ ...period, year: period.year + 1 });
    }
  }

  function handleGranularityChange(granularity: Granularity) {
    if (granularity === period.granularity) return;
    if (granularity === 'yearly') {
      onPeriodChange({ year: period.year, granularity });
    } else if (granularity === 'quarterly') {
      onPeriodChange({ year: period.year, granularity, quarter: getCurrentQuarter() });
    } else {
      onPeriodChange({ year: period.year, granularity, month: currentMonth });
    }
  }

  function handleQuarterChange(quarter: 1 | 2 | 3 | 4) {
    onPeriodChange({ ...period, quarter });
  }

  function handleMonthChange(month: number) {
    onPeriodChange({ ...period, month });
  }

  const activeChipStyle = {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  };
  const activeChipTextStyle = { color: colors.primary };
  const inactiveChipStyle = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  };
  const inactiveChipTextStyle = { color: colors.textSecondary };

  return (
    <View style={styles.container}>
      {/* Year row */}
      <View style={styles.yearRow}>
        <TouchableOpacity
          onPress={handleYearDecrement}
          disabled={period.year <= MIN_YEAR}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.chevron}
        >
          <MaterialCommunityIcons
            name="chevron-left"
            size={24}
            color={period.year <= MIN_YEAR ? colors.textDisabled : colors.textPrimary}
          />
        </TouchableOpacity>
        <Text style={[styles.yearText, { color: colors.textPrimary }]}>{period.year}</Text>
        <TouchableOpacity
          onPress={handleYearIncrement}
          disabled={period.year >= currentYear}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.chevron}
        >
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color={period.year >= currentYear ? colors.textDisabled : colors.textPrimary}
          />
        </TouchableOpacity>
      </View>

      {/* Granularity chips row */}
      {!yearOnly && (
        <View style={styles.chipsRow}>
          {GRANULARITY_LABELS.map(({ key, label }) => {
            const isActive = period.granularity === key;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => handleGranularityChange(key)}
                style={[
                  styles.chip,
                  isActive ? activeChipStyle : inactiveChipStyle,
                ]}
              >
                <Text style={[styles.chipText, isActive ? activeChipTextStyle : inactiveChipTextStyle]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Period selector row (conditional) */}
      {!yearOnly && period.granularity === 'quarterly' && (
        <View style={styles.chipsRow}>
          {QUARTERS.map((q) => {
            const isActive = period.quarter === q;
            return (
              <TouchableOpacity
                key={q}
                onPress={() => handleQuarterChange(q)}
                style={[
                  styles.chip,
                  styles.quarterChip,
                  isActive ? activeChipStyle : inactiveChipStyle,
                ]}
              >
                <Text style={[styles.chipText, isActive ? activeChipTextStyle : inactiveChipTextStyle]}>
                  {`Q${q}`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {!yearOnly && period.granularity === 'monthly' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.monthScrollContent}
        >
          {MONTHS.map((m) => {
            const isActive = period.month === m;
            const isFuture = period.year === currentYear && m > currentMonth;
            return (
              <TouchableOpacity
                key={m}
                onPress={() => handleMonthChange(m)}
                style={[
                  styles.chip,
                  isActive ? activeChipStyle : inactiveChipStyle,
                  styles.monthChip,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    isActive ? activeChipTextStyle : inactiveChipTextStyle,
                    isFuture && !isActive && { color: colors.textDisabled },
                  ]}
                >
                  {getMonthName(m).slice(0, 3)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chevron: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  yearText: {
    fontSize: 16,
    fontWeight: '700',
    minWidth: 48,
    textAlign: 'center',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 8,
  },
  quarterChip: {
    flex: 1,
  },
  monthChip: {
    flex: 0,
    width: 52,
    minHeight: 44,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '400',
  },
  monthScrollContent: {
    flexDirection: 'row',
    gap: 8,
  },
});
