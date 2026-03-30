import React, { useEffect, useRef, type ComponentProps } from 'react';
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
import { router, type Href } from 'expo-router';
import { useTheme } from '@/lib/theme-context';
import { useAuthStore } from '@/lib/store';
import { TOUR_STEPS } from '@/lib/tour';

const TAB_BAR_HEIGHT = Platform.select({ ios: 49, android: 56, default: 56 })!;

export function TourGuideCard() {
  const { colors, shadows } = useTheme();
  const { tourStep, setTourStep, setOnboardingCompleted } = useAuthStore();
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
      router.replace('/pin-setup');
    } else {
      const next = tourStep! + 1;
      setTourStep(next);
      router.replace(TOUR_STEPS[next].route as Href);
    }
  }

  function handleSkip() {
    setOnboardingCompleted();
    setTourStep(null);
    router.replace('/pin-setup');
  }

  return (
    <Portal>
      <Animated.View
        style={[
          styles.card,
          {
            bottom: bottomOffset,
            transform: [{ translateY }],
            backgroundColor: colors.surface,
            ...shadows.hero,
          },
        ]}
      >
        {/* Icon pill + step counter */}
        <View style={styles.topRow}>
          <View style={[styles.iconPill, { backgroundColor: colors.primarySoft }]}>
            <MaterialCommunityIcons
              name={step.icon as ComponentProps<typeof MaterialCommunityIcons>['name']}
              size={22}
              color={colors.primary}
            />
          </View>
          <View style={styles.dotsRow}>
            {TOUR_STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === tourStep
                    ? [styles.dotActive, { backgroundColor: colors.primary }]
                    : [styles.dotInactive, { backgroundColor: colors.border }],
                ]}
              />
            ))}
          </View>
        </View>

        {/* Title + body */}
        <Text style={[styles.title, { color: colors.textPrimary }]}>{step.title}</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>{step.body}</Text>

        {/* Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity onPress={handleSkip} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip Tour</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.ctaBtn, { backgroundColor: colors.primary }]} onPress={handleCta} activeOpacity={0.85}>
            <Text style={[styles.ctaText, { color: colors.textOnPrimary }]}>{step.cta}</Text>
            {!isLast && (
              <MaterialCommunityIcons name="arrow-right" size={16} color={colors.textOnPrimary} />
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
    borderRadius: 20,
    padding: 20,
    gap: 10,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 18,
  },
  dotInactive: {
    width: 6,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 24,
  },
  body: {
    fontSize: 14,
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
    fontWeight: '500',
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 100,
  },
  ctaText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
