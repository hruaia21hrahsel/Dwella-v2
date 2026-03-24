import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Text as SvgText, Rect, Path, Line } from 'react-native-svg';

const accent = '#F59E0B';

// SVG viewBox constants — shared across all fragments
const VB = '10 30 180 115';

interface Props {
  color?: string;
  size?: number;
}

/**
 * Animated splash logo with staggered assembly.
 * Each SVG fragment is wrapped in its own Animated.View for reliable opacity control.
 *
 * Sequence:
 * 1. "dwe" text fades in
 * 2. Roof draws in
 * 3. Left pillar appears
 * 4. Right pillar appears
 * 5. "a" fades in
 * 6. Underline sweeps in
 * 7-9. Sparkles pop in one by one
 *
 * After assembly, a gentle pulse plays while waiting for auth.
 */
export function AnimatedSplash({ color = '#FFFFFF', size = 160 }: Props) {
  const opacities = useRef(
    Array.from({ length: 9 }, () => new Animated.Value(0))
  ).current;

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const stagger = Animated.stagger(
      100,
      opacities.map((anim, i) =>
        Animated.timing(anim, {
          toValue: 1,
          duration: i < 6 ? 350 : 200, // SVG elements: 350ms, sparkles: 200ms
          useNativeDriver: true,
        })
      )
    );

    stagger.start(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.04,
            duration: 1400,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1400,
            useNativeDriver: true,
          }),
        ])
      ).start();
    });
  }, []);

  const [dwe, roof, p1, p2, a, line, s1, s2, s3] = opacities;

  return (
    <Animated.View style={[styles.wrapper, { transform: [{ scale: pulseAnim }] }]}>
      <View style={[styles.svgContainer, { width: size, height: size }]}>
        {/* Layer 1: "dwe" text */}
        <Animated.View style={[styles.layer, { opacity: dwe }]}>
          <Svg viewBox={VB} width={size} height={size}>
            <SvgText
              x={18} y={125}
              fontFamily="Georgia, serif" fontSize={54}
              fontWeight="400" fill={color} letterSpacing={1}
            >
              dwe
            </SvgText>
          </Svg>
        </Animated.View>

        {/* Layer 2: Roof */}
        <Animated.View style={[styles.layer, { opacity: roof }]}>
          <Svg viewBox={VB} width={size} height={size}>
            <Path
              d="M116 76 L135 50 L154 76"
              fill="none" stroke={color} strokeWidth={4}
              strokeLinecap="round" strokeLinejoin="round"
            />
          </Svg>
        </Animated.View>

        {/* Layer 3: Left pillar */}
        <Animated.View style={[styles.layer, { opacity: p1 }]}>
          <Svg viewBox={VB} width={size} height={size}>
            <Rect x={122} y={74} width={6} height={53} rx={1} fill={color} />
          </Svg>
        </Animated.View>

        {/* Layer 4: Right pillar */}
        <Animated.View style={[styles.layer, { opacity: p2 }]}>
          <Svg viewBox={VB} width={size} height={size}>
            <Rect x={142} y={74} width={6} height={53} rx={1} fill={color} />
          </Svg>
        </Animated.View>

        {/* Layer 5: "a" */}
        <Animated.View style={[styles.layer, { opacity: a }]}>
          <Svg viewBox={VB} width={size} height={size}>
            <SvgText
              x={154} y={125}
              fontFamily="Georgia, serif" fontSize={54}
              fontWeight="400" fill={color}
            >
              a
            </SvgText>
          </Svg>
        </Animated.View>

        {/* Layer 6: Underline */}
        <Animated.View style={[styles.layer, { opacity: line }]}>
          <Svg viewBox={VB} width={size} height={size}>
            <Line
              x1={18} y1={138} x2={185} y2={138}
              stroke={color} strokeWidth={1.5} opacity={0.2}
            />
          </Svg>
        </Animated.View>

        {/* Layer 7: Sparkle 1 (large) */}
        <Animated.View style={[styles.layer, { opacity: s1 }]}>
          <Svg viewBox={VB} width={size} height={size}>
            <Path
              d="M158 42 L160 36 L162 42 L168 44 L162 46 L160 52 L158 46 L152 44 Z"
              fill={accent}
            />
          </Svg>
        </Animated.View>

        {/* Layer 8: Sparkle 2 (medium) */}
        <Animated.View style={[styles.layer, { opacity: s2 }]}>
          <Svg viewBox={VB} width={size} height={size}>
            <Path
              d="M168 56 L169 53 L170 56 L173 57 L170 58 L169 61 L168 58 L165 57 Z"
              fill={accent} opacity={0.7}
            />
          </Svg>
        </Animated.View>

        {/* Layer 9: Sparkle 3 (small) */}
        <Animated.View style={[styles.layer, { opacity: s3 }]}>
          <Svg viewBox={VB} width={size} height={size}>
            <Path
              d="M148 36 L149 34 L150 36 L152 37 L150 38 L149 40 L148 38 L146 37 Z"
              fill={accent} opacity={0.5}
            />
          </Svg>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  svgContainer: {
    position: 'relative',
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
  },
});
