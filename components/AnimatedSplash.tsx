import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Text as SvgText, Rect, Path, Line, Defs, RadialGradient, Stop, Circle } from 'react-native-svg';

const accent = '#F59E0B';
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// SVG viewBox constants
const VB = '10 30 180 115';

interface Props {
  /** Logo fill color */
  color?: string;
  /** Logo width (height scales proportionally) */
  logoWidth?: number;
  /** Gradient start color */
  gradientStart?: string;
  /** Gradient end color */
  gradientEnd?: string;
}

/**
 * Premium animated splash screen.
 *
 * - Deep teal gradient background
 * - Soft radial glow behind logo
 * - Logo assembles with slide-up + fade (not just opacity)
 * - Sparkles pop in with scale
 * - Gentle breathe animation while idle
 */
export function AnimatedSplash({
  color = '#FFFFFF',
  logoWidth = 260,
  gradientStart = '#00897B',
  gradientEnd = '#004D40',
}: Props) {
  // Logo height proportional to viewBox aspect (115/180)
  const logoHeight = logoWidth * (115 / 180);

  // 9 elements: dwe, roof, pillar1, pillar2, a, underline, sparkle1, sparkle2, sparkle3
  const opacities = useRef(Array.from({ length: 9 }, () => new Animated.Value(0))).current;
  const slideYs = useRef(Array.from({ length: 6 }, () => new Animated.Value(18))).current;
  const sparkleScales = useRef(Array.from({ length: 3 }, () => new Animated.Value(0))).current;

  // Glow behind logo
  const glowOpacity = useRef(new Animated.Value(0)).current;

  // Breathe pulse
  const breatheScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Fade in glow first
    const glowIn = Animated.timing(glowOpacity, {
      toValue: 1, duration: 600, useNativeDriver: true,
    });

    // Staggered entrance for logo elements (slide up + fade)
    const logoEntrance = Animated.stagger(
      180,
      opacities.slice(0, 6).map((opacity, i) =>
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1, duration: 450, useNativeDriver: true,
          }),
          Animated.timing(slideYs[i], {
            toValue: 0, duration: 450, useNativeDriver: true,
          }),
        ])
      )
    );

    // Sparkles pop in with scale
    const sparklesEntrance = Animated.stagger(
      150,
      opacities.slice(6).map((opacity, i) =>
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1, duration: 250, useNativeDriver: true,
          }),
          Animated.spring(sparkleScales[i], {
            toValue: 1, friction: 4, tension: 200, useNativeDriver: true,
          }),
        ])
      )
    );

    Animated.sequence([
      glowIn,
      Animated.delay(100),
      logoEntrance,
      sparklesEntrance,
    ]).start(() => {
      // Gentle breathe loop
      Animated.loop(
        Animated.sequence([
          Animated.timing(breatheScale, {
            toValue: 1.025, duration: 1800, useNativeDriver: true,
          }),
          Animated.timing(breatheScale, {
            toValue: 1, duration: 1800, useNativeDriver: true,
          }),
        ])
      ).start();
    });
  }, []);

  const [dwe, roof, p1, p2, a, line, s1, s2, s3] = opacities;
  const [dweSl, roofSl, p1Sl, p2Sl, aSl, lineSl] = slideYs;
  const [sc1, sc2, sc3] = sparkleScales;

  const renderLogoLayer = (
    opacity: Animated.Value,
    slideY: Animated.Value | null,
    scale: Animated.Value | null,
    children: React.ReactNode,
    key: string,
  ) => (
    <Animated.View
      key={key}
      style={[
        styles.layer,
        {
          opacity,
          transform: [
            ...(slideY ? [{ translateY: slideY }] : []),
            ...(scale ? [{ scale }] : []),
          ],
        },
      ]}
    >
      <Svg viewBox={VB} width={logoWidth} height={logoHeight}>
        {children}
      </Svg>
    </Animated.View>
  );

  return (
    <LinearGradient
      colors={[gradientStart, gradientEnd]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.fullScreen}
    >
      {/* Subtle ambient glow behind logo */}
      <Animated.View style={[styles.glowContainer, { opacity: glowOpacity }]}>
        <View style={styles.glow} />
      </Animated.View>

      <Animated.View style={[styles.logoArea, { transform: [{ scale: breatheScale }] }]}>
        <View style={[styles.svgContainer, { width: logoWidth, height: logoHeight }]}>
          {/* "dwe" */}
          {renderLogoLayer(dwe, dweSl, null,
            <SvgText x={18} y={125} fontFamily="Georgia, serif" fontSize={54}
              fontWeight="400" fill={color} letterSpacing={1}>dwe</SvgText>,
            'dwe'
          )}

          {/* Roof */}
          {renderLogoLayer(roof, roofSl, null,
            <Path d="M116 76 L135 50 L154 76" fill="none" stroke={color}
              strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />,
            'roof'
          )}

          {/* Left pillar */}
          {renderLogoLayer(p1, p1Sl, null,
            <Rect x={122} y={74} width={6} height={53} rx={1} fill={color} />,
            'p1'
          )}

          {/* Right pillar */}
          {renderLogoLayer(p2, p2Sl, null,
            <Rect x={142} y={74} width={6} height={53} rx={1} fill={color} />,
            'p2'
          )}

          {/* "a" */}
          {renderLogoLayer(a, aSl, null,
            <SvgText x={154} y={125} fontFamily="Georgia, serif" fontSize={54}
              fontWeight="400" fill={color}>a</SvgText>,
            'a'
          )}

          {/* Underline */}
          {renderLogoLayer(line, lineSl, null,
            <Line x1={18} y1={138} x2={185} y2={138} stroke={color}
              strokeWidth={1.5} opacity={0.25} />,
            'line'
          )}

          {/* Sparkle 1 — large */}
          {renderLogoLayer(s1, null, sc1,
            <Path d="M158 42 L160 36 L162 42 L168 44 L162 46 L160 52 L158 46 L152 44 Z"
              fill={accent} />,
            's1'
          )}

          {/* Sparkle 2 — medium */}
          {renderLogoLayer(s2, null, sc2,
            <Path d="M168 56 L169 53 L170 56 L173 57 L170 58 L169 61 L168 58 L165 57 Z"
              fill={accent} opacity={0.7} />,
            's2'
          )}

          {/* Sparkle 3 — small */}
          {renderLogoLayer(s3, null, sc3,
            <Path d="M148 36 L149 34 L150 36 L152 37 L150 38 L149 40 L148 38 L146 37 Z"
              fill={accent} opacity={0.5} />,
            's3'
          )}
        </View>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  logoArea: {
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
