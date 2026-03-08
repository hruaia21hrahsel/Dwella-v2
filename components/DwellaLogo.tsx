import Svg, { Text as SvgText, Rect, Path, Line } from 'react-native-svg';

const accent = '#F59E0B';

interface Props {
  size?: number;
  width?: number;
  height?: number;
  color?: string;
}

/**
 * Sparkle Cluster logo rendered as SVG.
 * Pass `size` for square rendering, or `width`/`height` for custom dimensions.
 */
export function DwellaLogo({ size = 40, width, height, color = '#1E293B' }: Props) {
  return (
    <Svg viewBox="10 30 180 115" width={width ?? size} height={height ?? size}>
      <SvgText
        x={18}
        y={125}
        fontFamily="Georgia, serif"
        fontSize={54}
        fontWeight="400"
        fill={color}
        letterSpacing={1}
      >
        dwe
      </SvgText>
      <Rect x={122} y={74} width={6} height={53} rx={1} fill={color} />
      <Rect x={142} y={74} width={6} height={53} rx={1} fill={color} />
      <Path
        d="M116 76 L135 50 L154 76"
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <SvgText
        x={154}
        y={125}
        fontFamily="Georgia, serif"
        fontSize={54}
        fontWeight="400"
        fill={color}
      >
        a
      </SvgText>
      <Line
        x1={18}
        y1={138}
        x2={185}
        y2={138}
        stroke={color}
        strokeWidth={1.5}
        opacity={0.2}
      />
      {/* AI Sparkles */}
      <Path
        d="M158 42 L160 36 L162 42 L168 44 L162 46 L160 52 L158 46 L152 44 Z"
        fill={accent}
      />
      <Path
        d="M168 56 L169 53 L170 56 L173 57 L170 58 L169 61 L168 58 L165 57 Z"
        fill={accent}
        opacity={0.7}
      />
      <Path
        d="M148 36 L149 34 L150 36 L152 37 L150 38 L149 40 L148 38 L146 37 Z"
        fill={accent}
        opacity={0.5}
      />
    </Svg>
  );
}
