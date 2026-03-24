import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, Image, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const logoSource = require('@/assets/images/logo-splash.png');

interface Props {
  gradientStart?: string;
  gradientEnd?: string;
}

/**
 * Premium animated splash screen using the actual Dwella logo.
 *
 * Sequence:
 * 1. Soft ambient glow fades in
 * 2. Logo scales up from 0.7 → 1.0 with fade-in (ease-out curve)
 * 3. Gentle breathe loop while waiting for auth
 */
export function AnimatedSplash({
  gradientStart = '#00897B',
  gradientEnd = '#004D40',
}: Props) {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.7)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(0.8)).current;
  const breatheScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      // 1. Glow fades in and expands
      Animated.parallel([
        Animated.timing(glowOpacity, {
          toValue: 1, duration: 500, useNativeDriver: true,
        }),
        Animated.timing(glowScale, {
          toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }),
      ]),
      // 2. Logo scales up + fades in
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1, duration: 700, useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1, friction: 7, tension: 40, useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      // 3. Gentle breathe loop
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

      {/* Logo */}
      <Animated.View
        style={{
          opacity: logoOpacity,
          transform: [
            { scale: Animated.multiply(logoScale, breatheScale) },
          ],
        }}
      >
        <Image source={logoSource} style={styles.logo} resizeMode="contain" />
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
  logo: {
    width: 200,
    height: 200,
  },
});
