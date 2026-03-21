import { View } from 'react-native';
import { VictoryChart, VictoryLine } from 'victory-native';
import { useTheme } from '@/lib/theme-context';
import type { MonthlyPL } from '@/lib/reports';

interface SparklineChartProps {
  data: MonthlyPL[];
  width?: number;
  height?: number;
}

export function SparklineChart({ data, width = 100, height = 40 }: SparklineChartProps) {
  const { colors } = useTheme();

  // Derive net P&L points
  const points = data.map((d, i) => ({ x: i + 1, y: d.income - d.expense }));

  // If no data or all zeros, render empty placeholder
  const allZero = points.every((p) => p.y === 0);
  if (points.length === 0 || allZero) {
    return <View style={{ height, width }} />;
  }

  return (
    <View style={{ height, width }}>
      <VictoryChart
        height={height}
        width={width}
        padding={0}
      >
        <VictoryLine
          data={points}
          style={{
            data: { stroke: colors.primary, strokeWidth: 2 },
          }}
        />
      </VictoryChart>
    </View>
  );
}

