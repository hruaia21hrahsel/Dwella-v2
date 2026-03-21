import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  VictoryChart,
  VictoryStack,
  VictoryBar,
  VictoryAxis,
} from 'victory-native';
import { useTheme } from '@/lib/theme-context';
import { ChartTooltip } from '@/components/ChartTooltip';
import type { OccupancyPoint } from '@/lib/reports';

interface OccupancyChartProps {
  data: OccupancyPoint[];
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

export function OccupancyChart({ data, hasData, emptyLabel = 'No data' }: OccupancyChartProps) {
  const { colors } = useTheme();
  const [tooltip, setTooltip] = useState<TooltipState>(HIDDEN_TOOLTIP);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Enrich data with source fields for tap event retrieval
  const filledData = data.map((d, i) => ({
    x: d.label,
    y: d.filled,
    _index: i,
    _filled: d.filled,
    _vacant: d.vacant,
  }));
  const vacantData = data.map((d, i) => ({
    x: d.label,
    y: d.vacant,
    _index: i,
    _filled: d.filled,
    _vacant: d.vacant,
  }));

  type DatumShape = { x: string; _index: number; _filled: number; _vacant: number };

  const events = [
    {
      target: 'data' as const,
      eventHandlers: {
        onPress: (_evt: unknown, props: { datum: DatumShape; index: number }) => {
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
              value: `${props.datum._filled} filled / ${props.datum._vacant} vacant`,
              x: 60,
              y: 10,
            });
          }
          return [];
        },
      },
    },
  ];

  // Style functions: dim non-selected bars
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filledStyle: any = {
    data: {
      fill: ({ datum }: { datum: DatumShape }) => {
        const dimmed = selectedIndex !== null && selectedIndex !== datum._index;
        return dimmed ? `${colors.statusConfirmed}66` : colors.statusConfirmed;
      },
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vacantStyle: any = {
    data: {
      fill: ({ datum }: { datum: DatumShape }) => {
        const dimmed = selectedIndex !== null && selectedIndex !== datum._index;
        return dimmed ? `${colors.statusPendingSoft}66` : colors.statusPendingSoft;
      },
    },
  };

  return (
    <View>
      <View style={styles.container}>
        <VictoryChart
          height={180}
          domainPadding={{ x: 20 }}
          padding={{ top: 10, bottom: 30, left: 40, right: 10 }}
        >
          <VictoryAxis
            style={{
              tickLabels: { fontSize: 13, fill: colors.textSecondary },
              axis: { stroke: colors.border },
            }}
          />
          <VictoryAxis
            dependentAxis
            style={{
              tickLabels: { fontSize: 13, fill: colors.textSecondary },
              axis: { stroke: colors.border },
              grid: { stroke: colors.border, strokeDasharray: '4,4' },
            }}
          />
          <VictoryStack>
            <VictoryBar data={filledData} style={filledStyle} events={events} />
            <VictoryBar data={vacantData} style={vacantStyle} events={events} />
          </VictoryStack>
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
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.statusConfirmed }]} />
          <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>Filled</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.statusPendingSoft }]} />
          <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>Vacant</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 180,
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
  legend: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
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
