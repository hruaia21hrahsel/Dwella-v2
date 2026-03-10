import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { DwellaLogo } from './DwellaLogo';

interface Props {
  visible: boolean;
}

export function SplashScreenOverlay({ visible }: Props) {
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.9)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const entryDone = useRef(false);

  useEffect(() => {
    if (entryDone.current) return;
    entryDone.current = true;
    Animated.sequence([
      Animated.delay(80),
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 520, useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, damping: 22, stiffness: 130, useNativeDriver: true }),
      ]),
      Animated.timing(taglineOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (!visible) {
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 550,
        delay: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.root, { opacity: screenOpacity }]}
    >
      <LinearGradient
        colors={['#07070F', '#0F0C20']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.glowWrap} pointerEvents="none">
        <View style={styles.glow} />
      </View>
      <View style={styles.center} pointerEvents="none">
        <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }], alignItems: 'center' }}>
          <DwellaLogo size={240} color="#EDE9FF" />
          <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
            your rental, simplified
          </Animated.Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    zIndex: 9999,
    elevation: 9999,
  },
  center: {
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
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: '#4F46E5',
    opacity: 0.06,
    marginTop: -60,
  },
  tagline: {
    marginTop: 18,
    fontSize: 11,
    letterSpacing: 3.5,
    color: '#4A4A6A',
    textTransform: 'lowercase',
  },
});
