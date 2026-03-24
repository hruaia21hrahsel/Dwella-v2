import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Text as SvgText, Rect, Path, Line } from 'react-native-svg';

const accent = '#F59E0B';
const VB = '10 30 180 115';

interface Props {
  color?: string;
  logoWidth?: number;
  gradientStart?: string;
  gradientEnd?: string;
}

/**
 * Premium animated splash with staggered logo assembly.
 *
 * 1. Ambient glow fades in
 * 2. Logo pieces slide up + fade in one by one:
 *    dwe → roof → left pillar → right pillar → a → underline
 * 3. Sparkles pop in with spring bounce
 * 4. Gentle breathe loop while waiting
 */
export function AnimatedSplash({
  color = '#FFFFFF',
  logoWidth = 280,
  gradientStart = '#00897B',
  gradientEnd = '#004D40',
}: Props) {
  const logoHeight = logoWidth * (115 / 180);

  // 6 logo elements + 3 sparkles = 9 total
  const opacities = useRef(Array.from({ length: 9 }, () => new Animated.Value(0))).current;
  const slideYs = useRef(Array.from({ length: 6 }, () => new Animated.Value(20))).current;
  const sparkleScales = useRef(Array.from({ length: 3 }, () => new Animated.Value(0))).current;

  const glowOpacity = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(0.8)).current;
  const breatheScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      // Glow entrance
      Animated.parallel([
        Animated.timing(glowOpacity, {
          toValue: 1, duration: 500, useNativeDriver: true,
        }),
        Animated.timing(glowScale, {
          toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }),
      ]),
      Animated.delay(100),
      // Logo pieces slide up + fade in
      Animated.stagger(
        200,
        opacities.slice(0, 6).map((opacity, i) =>
          Animated.parallel([
            Animated.timing(opacity, {
              toValue: 1, duration: 500, easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(slideYs[i], {
              toValue: 0, duration: 500, easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ])
        )
      ),
      // Sparkles pop in with spring
      Animated.stagger(
        160,
        opacities.slice(6).map((opacity, i) =>
          Animated.parallel([
            Animated.timing(opacity, {
              toValue: 1, duration: 250, useNativeDriver: true,
            }),
            Animated.spring(sparkleScales[i], {
              toValue: 1, friction: 4, tension: 180, useNativeDriver: true,
            }),
          ])
        )
      ),
    ]).start(() => {
      // Gentle breathe
      Animated.loop(
        Animated.sequence([
          Animated.timing(breatheScale, {
            toValue: 1.02, duration: 2000, easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(breatheScale, {
            toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    });
  }, []);

  const [dwe, roof, p1, p2, a, line, s1, s2, s3] = opacities;
  const [dweSl, roofSl, p1Sl, p2Sl, aSl, lineSl] = slideYs;
  const [sc1, sc2, sc3] = sparkleScales;

  const layer = (
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
      {/* Ambient glow */}
      <Animated.View
        style={[
          styles.glowWrap,
          { opacity: glowOpacity, transform: [{ scale: glowScale }] },
        ]}
      >
        <View style={styles.glow} />
      </Animated.View>

      {/* Assembled logo */}
      <Animated.View style={[styles.logoArea, { transform: [{ scale: breatheScale }] }]}>
        <View style={[styles.svgContainer, { width: logoWidth, height: logoHeight }]}>
          {layer(dwe, dweSl, null,
            <SvgText x={18} y={125} fontFamily="Georgia, serif" fontSize={54}
              fontWeight="400" fill={color} letterSpacing={1}>dwe</SvgText>,
            'dwe'
          )}
          {layer(roof, roofSl, null,
            <Path d="M116 76 L135 50 L154 76" fill="none" stroke={color}
              strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />,
            'roof'
          )}
          {layer(p1, p1Sl, null,
            <Rect x={122} y={74} width={6} height={53} rx={1} fill={color} />,
            'p1'
          )}
          {layer(p2, p2Sl, null,
            <Rect x={142} y={74} width={6} height={53} rx={1} fill={color} />,
            'p2'
          )}
          {layer(a, aSl, null,
            <SvgText x={154} y={125} fontFamily="Georgia, serif" fontSize={54}
              fontWeight="400" fill={color}>a</SvgText>,
            'a'
          )}
          {layer(line, lineSl, null,
            <Line x1={18} y1={138} x2={185} y2={138} stroke={color}
              strokeWidth={1.5} opacity={0.25} />,
            'line'
          )}
          {layer(s1, null, sc1,
            <Path d="M158 42 L160 36 L162 42 L168 44 L162 46 L160 52 L158 46 L152 44 Z"
              fill={accent} />,
            's1'
          )}
          {layer(s2, null, sc2,
            <Path d="M168 56 L169 53 L170 56 L173 57 L170 58 L169 61 L168 58 L165 57 Z"
              fill={accent} opacity={0.7} />,
            's2'
          )}
          {layer(s3, null, sc3,
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
  glowWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(255,255,255,0.08)',
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
