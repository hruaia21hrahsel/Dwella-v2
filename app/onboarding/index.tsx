/**
 * app/onboarding/index.tsx
 *
 * Full-screen onboarding carousel shown exactly once on first login.
 * To add or reorder steps, edit the SLIDES array only — no other changes needed.
 *
 * State:  onboardingCompleted in Zustand (persisted to AsyncStorage via persist middleware).
 * Re-trigger: Profile → "Replay App Tour" calls resetOnboarding() then pushes here.
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  ListRenderItemInfo,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/lib/store';

const { width: W } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type SlideVariant = 'welcome' | 'feature' | 'completion';

interface Slide {
  id: string;
  variant: SlideVariant;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  /** Tint applied to the icon background pill */
  accentColor: string;
  title: string;
  body: string;
  /** Optional bullet points shown below the body */
  bullets?: string[];
  /** Override the "Next" button label on this specific slide */
  cta?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Slide data  ← only edit this to add / reorder steps
// ─────────────────────────────────────────────────────────────────────────────

const SLIDES: Slide[] = [
  {
    id: 'welcome',
    variant: 'welcome',
    icon: 'home-heart',
    accentColor: 'rgba(255,255,255,0.20)',
    title: 'Welcome to Dwella',
    body: 'Your all-in-one rental management platform. Track rent, manage tenants, and get AI-powered insights — all in one place.',
  },
  {
    id: 'property',
    variant: 'feature',
    icon: 'home-city',
    accentColor: Colors.primarySoft,
    title: 'Add Your First Property',
    body: 'Create a property in seconds and start organising your units.',
    bullets: [
      'Open the Properties tab',
      'Tap  +  to create a property',
      'Enter name, address, and unit count',
    ],
  },
  {
    id: 'tenant',
    variant: 'feature',
    icon: 'account-plus',
    accentColor: '#EDE9FE',
    title: 'Invite Your Tenants',
    body: 'Add tenants under your property and share their unique invite link.',
    bullets: [
      'Add a tenant to any property',
      'Tap "Share Invite Link"',
      'Tenant accepts → instantly linked',
    ],
  },
  {
    id: 'payments',
    variant: 'feature',
    icon: 'credit-card-check-outline',
    accentColor: '#DBEAFE',
    title: 'Track Every Payment',
    body: 'Dwella auto-generates monthly rows for each tenant. Log, confirm, and get alerts — automatically.',
    bullets: [
      'Log payments and upload proof',
      'Confirm receipts with one tap',
      'Auto-flagged as overdue when late',
    ],
  },
  {
    id: 'ai',
    variant: 'feature',
    icon: 'robot-outline',
    accentColor: '#F0FDF4',
    title: 'Your AI Assistant',
    body: 'Ask anything in plain English, in-app or on Telegram.',
    bullets: [
      '"Who hasn\'t paid this month?"',
      '"Send reminders to overdue tenants"',
      'Link Telegram in Profile → get alerts in chat',
    ],
  },
  {
    id: 'done',
    variant: 'completion',
    icon: 'check-decagram',
    accentColor: 'rgba(255,255,255,0.20)',
    title: "You're All Set!",
    body: 'Start by adding your first property, then invite your tenants. Dwella handles the rest.',
    cta: 'Start Using Dwella',
  },
];

const TOTAL = SLIDES.length;

// ─────────────────────────────────────────────────────────────────────────────
// Feature preview card  (shown inside "feature" variant slides)
// ─────────────────────────────────────────────────────────────────────────────

function BulletList({ items }: { items: string[] }) {
  return (
    <View style={bullet.wrap}>
      {items.map((item, i) => (
        <View key={i} style={bullet.row}>
          <View style={bullet.dot} />
          <Text style={bullet.text}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const bullet = StyleSheet.create({
  wrap: { gap: 10, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
    marginTop: 7,
  },
  text: { flex: 1, fontSize: 15, color: Colors.textSecondary, lineHeight: 22 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Individual slide content  (rendered inside the FlatList)
// ─────────────────────────────────────────────────────────────────────────────

interface SlideProps {
  slide: Slide;
  index: number;
  currentIndex: number;
}

function SlideContent({ slide, index, currentIndex }: SlideProps) {
  // Animate icon scale + content opacity when this slide becomes active
  const scale = useRef(new Animated.Value(index === 0 ? 1 : 0.7)).current;
  const opacity = useRef(new Animated.Value(index === 0 ? 1 : 0)).current;

  useEffect(() => {
    if (index === currentIndex) {
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 60,
          friction: 7,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Reset so the animation re-fires when returning to this slide
      scale.setValue(0.7);
      opacity.setValue(0);
    }
  }, [currentIndex]);

  const isWelcome = slide.variant === 'welcome';
  const isCompletion = slide.variant === 'completion';
  const isFullBleed = isWelcome || isCompletion;

  return (
    <View style={[slide_s.root, { width: W }]}>
      {isFullBleed ? (
        // ── Welcome / Completion: icon + text centred on the gradient ──
        <Animated.View style={[slide_s.fullBleed, { opacity }]}>
          <Animated.View
            style={[
              slide_s.iconCircle,
              { backgroundColor: slide.accentColor, transform: [{ scale }] },
            ]}
          >
            <MaterialCommunityIcons
              name={slide.icon}
              size={64}
              color={Colors.textOnGradient}
            />
          </Animated.View>
          <Text style={slide_s.fullBleedTitle}>{slide.title}</Text>
          <Text style={slide_s.fullBleedBody}>{slide.body}</Text>
        </Animated.View>
      ) : (
        // ── Feature slides: white card floating on gradient ──
        <Animated.View style={[slide_s.card, { opacity }]}>
          {/* Icon pill */}
          <Animated.View
            style={[
              slide_s.featureIconWrap,
              { backgroundColor: slide.accentColor, transform: [{ scale }] },
            ]}
          >
            <MaterialCommunityIcons
              name={slide.icon}
              size={36}
              color={Colors.primary}
            />
          </Animated.View>

          <Text style={slide_s.cardTitle}>{slide.title}</Text>
          <Text style={slide_s.cardBody}>{slide.body}</Text>

          {slide.bullets && slide.bullets.length > 0 && (
            <View style={slide_s.bulletSection}>
              <BulletList items={slide.bullets} />
            </View>
          )}
        </Animated.View>
      )}
    </View>
  );
}

const slide_s = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  // Welcome / completion layout
  fullBleed: {
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: 8,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  fullBleedTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textOnGradient,
    textAlign: 'center',
    lineHeight: 36,
  },
  fullBleedBody: {
    fontSize: 16,
    color: Colors.textOnGradientMuted,
    textAlign: 'center',
    lineHeight: 25,
  },
  // Feature card layout
  card: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 28,
    gap: 12,
    // Shadow
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 24,
      },
      android: { elevation: 8 },
    }),
  },
  featureIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    lineHeight: 30,
  },
  cardBody: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 23,
  },
  bulletSection: {
    marginTop: 4,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Progress bar (thin animated strip at the top)
// ─────────────────────────────────────────────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  const width = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(width, {
      toValue: (current + 1) / total,
      duration: 350,
      useNativeDriver: false, // width animation can't use native driver
    }).start();
  }, [current]);

  return (
    <View style={pb.track}>
      <Animated.View
        style={[
          pb.fill,
          {
            width: width.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }),
          },
        ]}
      />
    </View>
  );
}

const pb = StyleSheet.create({
  track: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: Colors.textOnGradient,
    borderRadius: 2,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Dot indicators
// ─────────────────────────────────────────────────────────────────────────────

function Dots({ total, current }: { total: number; current: number }) {
  return (
    <View style={dot_s.row}>
      {Array.from({ length: total }).map((_, i) => {
        const isActive = i === current;
        return (
          <View
            key={i}
            style={[
              dot_s.dot,
              isActive ? dot_s.dotActive : dot_s.dotInactive,
            ]}
          />
        );
      })}
    </View>
  );
}

const dot_s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { height: 7, borderRadius: 4 },
  dotActive: { width: 22, backgroundColor: Colors.textOnGradient },
  dotInactive: { width: 7, backgroundColor: 'rgba(255,255,255,0.35)' },
});

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setOnboardingCompleted } = useAuthStore();

  const [currentIndex, setCurrentIndex] = useState(0);
  const listRef = useRef<FlatList<Slide>>(null);

  // Called on "Get Started" or Skip
  const finish = useCallback(() => {
    setOnboardingCompleted();
    router.replace('/(tabs)/dashboard');
  }, []);

  // Advance to next slide or finish
  function handleNext() {
    if (currentIndex < TOTAL - 1) {
      const next = currentIndex + 1;
      listRef.current?.scrollToIndex({ index: next, animated: true });
      setCurrentIndex(next);
    } else {
      finish();
    }
  }

  // Go back one slide
  function handleBack() {
    if (currentIndex > 0) {
      const prev = currentIndex - 1;
      listRef.current?.scrollToIndex({ index: prev, animated: true });
      setCurrentIndex(prev);
    }
  }

  // Sync state when user swipes manually
  function handleScrollEnd(e: { nativeEvent: { contentOffset: { x: number } } }) {
    const index = Math.round(e.nativeEvent.contentOffset.x / W);
    setCurrentIndex(index);
  }

  function renderItem({ item, index }: ListRenderItemInfo<Slide>) {
    return <SlideContent slide={item} index={index} currentIndex={currentIndex} />;
  }

  const isFirst = currentIndex === 0;
  const isLast = currentIndex === TOTAL - 1;
  const ctaLabel = SLIDES[currentIndex].cta ?? (isLast ? 'Get Started' : 'Next');

  return (
    <LinearGradient
      colors={Colors.gradientHero as [string, string]}
      style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      {/* ── Top bar: progress + skip ── */}
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.stepLabel}>
            Step {currentIndex + 1} of {TOTAL}
          </Text>
          <ProgressBar current={currentIndex} total={TOTAL} />
        </View>

        {!isLast && (
          <TouchableOpacity
            onPress={finish}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.skipBtn}
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Slides ── */}
      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(s) => s.id}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleScrollEnd}
        // Prevent accidental scroll interference with navigation buttons
        decelerationRate="fast"
        style={styles.list}
      />

      {/* ── Bottom bar: back | dots | next ── */}
      <View style={styles.bottomBar}>
        {/* Back */}
        <TouchableOpacity
          onPress={handleBack}
          disabled={isFirst}
          style={[styles.backBtn, isFirst && styles.hidden]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={20}
            color={Colors.textOnGradient}
          />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Dots total={TOTAL} current={currentIndex} />

        {/* Next / CTA */}
        <TouchableOpacity style={styles.nextBtn} onPress={handleNext} activeOpacity={0.85}>
          <Text style={styles.nextText}>{ctaLabel}</Text>
          {!isLast && (
            <MaterialCommunityIcons name="arrow-right" size={16} color={Colors.primary} />
          )}
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 16,
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textOnGradientMuted,
    marginBottom: 6,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  skipBtn: {
    paddingLeft: 8,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textOnGradientMuted,
  },
  // List
  list: {
    flex: 1,
  },
  // Bottom bar
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textOnGradient,
  },
  hidden: {
    opacity: 0,
    pointerEvents: 'none',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.textOnGradient,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 100,
  },
  nextText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
  },
});
