import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import {
  VictoryChart,
  VictoryBar,
  VictoryGroup,
  VictoryAxis,
} from 'victory-native';
import { useTheme } from '@/lib/theme-context';
import { formatCurrency } from '@/lib/utils';
import { ChartTooltip } from '@/components/ChartTooltip';
import type { MonthlyPL } from '@/lib/reports';

interface PLBarChartProps {
  data: MonthlyPL[];
  hasData: boolean;
  emptyLabel?: string;
}

interface TooltipState {
  visible: boolean;
  label: string;
  value: string;
  x: number;
  y: number;
}

const HIDDEN_TOOLTIP: TooltipState = { visible: false, label: '', value: '', x: 0, y: 0 };

type DatumShape = { x: string; y: number; _index: number; _series: 'income' | 'expense' };

export function PLBarChart({ data, hasData, emptyLabel = 'No data' }: PLBarChartProps) {
  const { colors } = useTheme();
  const [tooltip, setTooltip] = useState<TooltipState>(HIDDEN_TOOLTIP);
  const [selected, setSelected] = useState<{ series: 'income' | 'expense'; index: number } | null>(null);

  const incomeData: DatumShape[] = useMemo(
    () => data.map((d, i) => ({ x: d.label, y: d.income, _index: i, _series: 'income' })),
    [data],
  );

  const expenseData: DatumShape[] = useMemo(
    () => data.map((d, i) => ({ x: d.label, y: d.expense, _index: i, _series: 'expense' })),
    [data],
  );

  const events = [
    {
      target: 'data' as const,
      eventHandlers: {
        onPress: (_evt: unknown, props: { datum: DatumShape; index: number }) => {
          const idx = props.datum._index ?? props.index;
          const series = props.datum._series;
          const alreadySelected = selected?.series === series && selected?.index === idx;
          if (alreadySelected) {
            setSelected(null);
            setTooltip(HIDDEN_TOOLTIP);
          } else {
            setSelected({ series, index: idx });
            setTooltip({
              visible: true,
              label: `${props.datum.x} ${series === 'income' ? 'Income' : 'Expense'}`,
              value: formatCurrency(props.datum.y),
              x: 60,
              y: 10,
            });
          }
          return [];
        },
      },
    },
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const incomeStyle: any = {
    data: {
      fill: ({ datum }: { datum: DatumShape }) => {
        const dimmed = selected !== null && !(selected.series === 'income' && selected.index === datum._index);
        return dimmed ? `${colors.statusConfirmed}66` : colors.statusConfirmed;
      },
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const expenseStyle: any = {
    data: {
      fill: ({ datum }: { datum: DatumShape }) => {
        const dimmed = selected !== null && !(selected.series === 'expense' && selected.index === datum._index);
        return dimmed ? `${colors.error}66` : colors.error;
      },
    },
  };

  function dismissTooltip() {
    setSelected(null);
    setTooltip(HIDDEN_TOOLTIP);
  }

  return (
    <Pressable style={styles.container} onPress={dismissTooltip}>
      <VictoryChart
        height={200}
        domainPadding={{ x: 20 }}
        padding={{ top: 10, bottom: 30, left: 50, right: 10 }}
      >
        <VictoryAxis
          style={{
            tickLabels: { fontSize: 13, fill: colors.textSecondary },
            axis: { stroke: colors.border },
          }}
        />
        <VictoryAxis
          dependentAxis
          tickFormat={(v: number) => {
            if (v === 0) return '0';
            if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)}K`;
            return String(v);
          }}
          style={{
            tickLabels: { fontSize: 13, fill: colors.textSecondary },
            axis: { stroke: colors.border },
            grid: { stroke: colors.border, strokeDasharray: '4,4' },
          }}
        />
        <VictoryGroup offset={12}>
          <VictoryBar data={incomeData} style={incomeStyle} events={events} />
          <VictoryBar data={expenseData} style={expenseStyle} events={events} />
        </VictoryGroup>
      </VictoryChart>

      {!hasData && (
        <View style={styles.emptyOverlay} pointerEvents="none">
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{emptyLabel}</Text>
        </View>
      )}

      <ChartTooltip
        visible={tooltip.visible}
        label={tooltip.label}
        value={tooltip.value}
        x={tooltip.x}
        y={tooltip.y}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 200,
    position: 'relative',
  },
  emptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.5,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '400',
  },
});
