/**
 * app/onboarding/index.tsx
 *
 * Single welcome slide shown on first login. Tapping "Let's Explore" launches
 * the in-app guided tour via TourGuideCard (floating portal overlay).
 *
 * Re-trigger: Profile → "Replay App Tour" calls resetOnboarding() + setTourStep(0)
 * then pushes here.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/lib/theme-context';
import { useAuthStore } from '@/lib/store';
import { TOUR_STEPS } from '@/lib/tour';
import { useTrack, EVENTS } from '@/lib/analytics';

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setOnboardingCompleted, setTourStep } = useAuthStore();
  const { colors, gradients } = useTheme();
  const track = useTrack();

  function handleExplore() {
    track(EVENTS.ONBOARDING_COMPLETED, { skipped: false });
    setTourStep(0);
    router.replace(TOUR_STEPS[0].route as any);
  }

  function handleSkip() {
    track(EVENTS.ONBOARDING_COMPLETED, { skipped: true });
    setOnboardingCompleted();
    router.replace('/(tabs)/dashboard');
  }

  return (
    <LinearGradient
      colors={gradients.hero}
      style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      {/* Skip link top-right */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={handleSkip} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={[styles.skipText, { color: colors.textOnGradientMuted }]}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Centred welcome content */}
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="home-heart" size={64} color={colors.textOnGradient} />
        </View>

        <Text style={[styles.title, { color: colors.textOnGradient }]}>Welcome to Dwella</Text>
        <Text style={[styles.tagline, { color: colors.textOnGradient }]}>The AI that runs your rentals.</Text>
        <Text style={[styles.subtitle, { color: colors.textOnGradientMuted }]}>
          Your all-in-one rental management platform. Track rent, manage tenants, and get
          AI-powered insights — all in one place.
        </Text>
      </View>

      {/* CTA */}
      <View style={styles.bottom}>
        <TouchableOpacity style={[styles.ctaBtn, { backgroundColor: colors.textOnGradient }]} onPress={handleExplore} activeOpacity={0.85}>
          <Text style={[styles.ctaText, { color: colors.primary }]}>Let's Explore</Text>
          <MaterialCommunityIcons name="arrow-right" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topBar: {
    alignItems: 'flex-end',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 24,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 38,
  },
  tagline: {
    fontSize: 17,
    fontStyle: 'italic',
    textAlign: 'center',
    opacity: 0.9,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 25,
  },
  bottom: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    alignItems: 'center',
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 100,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '700',
  },
});
