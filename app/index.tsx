import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore } from '@/lib/store';
import { useTheme } from '@/lib/theme-context';
import { AnimatedSplash } from '@/components/AnimatedSplash';

export default function Index() {
  const { session, isLoading } = useAuthStore();
  const { colors } = useTheme();

  const exitOpacity = useRef(new Animated.Value(1)).current;
  const exitScale = useRef(new Animated.Value(1)).current;
  const isExiting = useRef(false);
  const [canNavigate, setCanNavigate] = useState(false);
  const animMinElapsed = useRef(false);
  const authResolved = useRef(false);

  useEffect(() => {
    SplashScreen.hideAsync();
    // Minimum display time so the full entrance animation plays (~2.5s)
    setTimeout(() => {
      animMinElapsed.current = true;
      tryExit();
    }, 2500);
  }, []);

  const tryExit = () => {
    if (!animMinElapsed.current || !authResolved.current || isExiting.current) return;
    isExiting.current = true;
    Animated.parallel([
      Animated.timing(exitScale, { toValue: 1.15, duration: 600, useNativeDriver: true }),
      Animated.timing(exitOpacity, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start(() => {
      setCanNavigate(true);
    });
  };

  // When auth resolves, mark ready and try exit
  useEffect(() => {
    if (!isLoading) {
      authResolved.current = true;
      tryExit();
    }
  }, [isLoading]);

  if (canNavigate) {
    if (session) {
      return <Redirect href="/(tabs)/dashboard" />;
    }
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.primary,
          opacity: exitOpacity,
          transform: [{ scale: exitScale }],
        },
      ]}
    >
      <AnimatedSplash size={160} color={colors.textOnPrimary} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
