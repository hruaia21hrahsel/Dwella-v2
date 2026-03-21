import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { VictoryPie } from 'victory-native';
import { useTheme } from '@/lib/theme-context';
import { formatCurrency } from '@/lib/utils';
import { ChartTooltip } from '@/components/ChartTooltip';
import type { CategoryBreakdown } from '@/lib/reports';

interface DonutChartProps {
  data: CategoryBreakdown[];
  totalAmount: number;
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

type DatumShape = { x: string; y: number; _index: number; _color: string };

export function DonutChart({ data, totalAmount, hasData, emptyLabel = 'No data' }: DonutChartProps) {
  const { colors } = useTheme();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>(HIDDEN_TOOLTIP);

  const displayData: DatumShape[] = hasData && data.length > 0
    ? data.map((d, i) => ({ x: d.label, y: d.amount, _index: i, _color: d.color }))
    : [{ x: 'No data', y: 1, _index: 0, _color: colors.border }];

  const events = [
    {
      target: 'data' as const,
      eventHandlers: {
        onPress: (_evt: unknown, props: { datum: DatumShape; index: number }) => {
          if (!hasData) return [];
          const idx = props.datum._index ?? props.index;
          const alreadySelected = selectedIndex === idx;
          if (alreadySelected) {
            setSelectedIndex(null);
            setTooltip(HIDDEN_TOOLTIP);
          } else {
            setSelectedIndex(idx);
            setTooltip({
              visible: true,
              label: props.datum.x,
              value: formatCurrency(props.datum.y),
              x: 20,
              y: 180,
            });
          }
          return [];
        },
      },
    },
    {
      target: 'parent' as const,
      eventHandlers: {
        onPress: () => { dismissTooltip(); return []; },
      },
    },
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pieStyle: any = {
    data: {
      fill: ({ datum }: { datum: DatumShape }) => datum._color,
      stroke: colors.background,
      strokeWidth: 2,
      opacity: ({ datum }: { datum: DatumShape }) => {
        if (selectedIndex === null) return 1;
        return datum._index === selectedIndex ? 1 : 0.4;
      },
    },
  };

  function dismissTooltip() {
    setSelectedIndex(null);
    setTooltip(HIDDEN_TOOLTIP);
  }

  return (
    <View>
      <View style={styles.container}>
        <VictoryPie
          data={displayData}
          innerRadius={60}
          style={pieStyle}
          events={events}
          height={220}
          width={220}
          padding={10}
        />

        {/* Center label overlay */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={styles.centerLabel}>
            <Text style={[styles.centerAmount, { color: colors.textPrimary }]}>
              {formatCurrency(totalAmount)}
            </Text>
            <Text style={[styles.centerTitle, { color: colors.textSecondary }]}>Total</Text>
          </View>
        </View>

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
      </View>

      {/* Legend */}
      {hasData && data.length > 0 && (
        <View style={styles.legend}>
          {data.filter((d) => d.amount > 0).map((d) => (
            <View key={d.category} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: d.color }]} />
              <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>{d.label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 220,
    height: 220,
    position: 'relative',
    alignSelf: 'center',
  },
  centerLabel: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerAmount: {
    fontSize: 20,
    fontWeight: '700',
  },
  centerTitle: {
    fontSize: 13,
    fontWeight: '400',
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
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 13,
    fontWeight: '400',
  },
});
