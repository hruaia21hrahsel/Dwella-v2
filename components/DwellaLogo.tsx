import Svg, { Text as SvgText, Rect, Path, Line } from 'react-native-svg';

interface Props {
  size?: number;
  width?: number;
  height?: number;
  color?: string;
}

/**
 * Pillar-mark logo rendered as SVG.
 * viewBox is cropped to the content area (10 58 180 88).
 * Pass `size` for square rendering, or `width`/`height` for custom dimensions.
 */
export function DwellaLogo({ size = 40, width, height, color = '#1E293B' }: Props) {
  return (
    <Svg viewBox="10 50 180 100" width={width ?? size} height={height ?? size}>
      <SvgText
        x="20"
        y="125"
        fontFamily="Georgia, serif"
        fontSize="54"
        fontWeight="400"
        fill={color}
        letterSpacing={1}
      >
        dwe
      </SvgText>
      <Rect x={122} y={72} width={5} height={55} rx={2} fill={color} />
      <Rect x={136} y={72} width={5} height={55} rx={2} fill={color} />
      <Path
        d="M122 78 C122 62 141 62 141 78"
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <SvgText
        x="148"
        y="125"
        fontFamily="Georgia, serif"
        fontSize="54"
        fontWeight="400"
        fill={color}
      >
        a
      </SvgText>
      <Line
        x1={20}
        y1={138}
        x2={180}
        y2={138}
        stroke={color}
        strokeWidth={1.5}
        opacity={0.2}
      />
    </Svg>
  );
}
