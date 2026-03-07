import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { Portal } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Shadows } from '@/constants/colors';
import { useAuthStore } from '@/lib/store';
import { TOUR_STEPS } from '@/lib/tour';

const TAB_BAR_HEIGHT = Platform.select({ ios: 49, android: 56, default: 56 })!;

export function TourGuideCard() {
  const { tourStep, setTourStep, setOnboardingCompleted } = useAuthStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(300)).current;

  const isVisible = tourStep !== null;

  useEffect(() => {
    if (isVisible) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 60,
        friction: 10,
      }).start();
    } else {
      translateY.setValue(300);
    }
  }, [tourStep]);

  if (!isVisible) return null;

  const step = TOUR_STEPS[tourStep!];
  const isLast = tourStep === TOUR_STEPS.length - 1;
  const bottomOffset = insets.bottom + TAB_BAR_HEIGHT + 8;

  function handleCta() {
    if (isLast) {
      setOnboardingCompleted();
      setTourStep(null);
      router.replace('/(tabs)/dashboard');
    } else {
      const next = tourStep! + 1;
      setTourStep(next);
      router.replace(TOUR_STEPS[next].route as any);
    }
  }

  function handleSkip() {
    setOnboardingCompleted();
    setTourStep(null);
    router.replace('/(tabs)/dashboard');
  }

  return (
    <Portal>
      <Animated.View
        style={[
          styles.card,
          { bottom: bottomOffset, transform: [{ translateY }] },
        ]}
      >
        {/* Icon pill + step counter */}
        <View style={styles.topRow}>
          <View style={styles.iconPill}>
            <MaterialCommunityIcons
              name={step.icon as any}
              size={22}
              color={Colors.primary}
            />
          </View>
          <View style={styles.dotsRow}>
            {TOUR_STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === tourStep ? styles.dotActive : styles.dotInactive,
                ]}
              />
            ))}
          </View>
        </View>

        {/* Title + body */}
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.body}>{step.body}</Text>

        {/* Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity onPress={handleSkip} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.skipText}>Skip Tour</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.ctaBtn} onPress={handleCta} activeOpacity={0.85}>
            <Text style={styles.ctaText}>{step.cta}</Text>
            {!isLast && (
              <MaterialCommunityIcons name="arrow-right" size={16} color={Colors.textOnPrimary} />
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Portal>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 24,
      },
      android: { elevation: 12 },
    }),
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconPill: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 18,
    backgroundColor: Colors.primary,
  },
  dotInactive: {
    width: 6,
    backgroundColor: Colors.border,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    lineHeight: 24,
  },
  body: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 21,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  skipText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 100,
  },
  ctaText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
});
