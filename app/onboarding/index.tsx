import { useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ListRenderItemInfo,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/lib/store';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Slide {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    icon: 'home-heart',
    title: 'Welcome to Dwella',
    body: 'Your all-in-one rental property manager. Track rent, manage tenants, and get AI-powered insights — all in one place.',
  },
  {
    icon: 'home-city',
    title: 'Add Your First Property',
    body: 'Tap the Property tab and hit + to add a property. Give it a name, address, and number of units.',
  },
  {
    icon: 'account-plus',
    title: 'Add & Invite Tenants',
    body: 'Add tenants under your property and share their unique invite link. Once they accept, they\'re linked and can view their payment history.',
  },
  {
    icon: 'receipt',
    title: 'Track Rent Payments',
    body: 'Log payments, upload proof, and confirm receipts. Dwella auto-tracks every month and alerts you when rent goes overdue.',
  },
  {
    icon: 'robot',
    title: 'Your AI Assistant',
    body: 'Chat in-app or link your Telegram account (Profile → Link Telegram). Ask anything: "Who hasn\'t paid?" or "Send reminders to overdue tenants."',
  },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const setOnboardingCompleted = useAuthStore((s) => s.setOnboardingCompleted);
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList<Slide>>(null);

  function onComplete() {
    setOnboardingCompleted();
    router.replace('/(tabs)/dashboard');
  }

  function handleNext() {
    if (currentIndex < SLIDES.length - 1) {
      const next = currentIndex + 1;
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
      setCurrentIndex(next);
    } else {
      onComplete();
    }
  }

  function renderItem({ item }: ListRenderItemInfo<Slide>) {
    return (
      <View style={styles.slide}>
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons name={item.icon} size={80} color={Colors.textOnGradient} />
        </View>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.body}>{item.body}</Text>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={Colors.gradientHero}
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      {/* Skip button */}
      <TouchableOpacity
        style={styles.skipButton}
        onPress={onComplete}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setCurrentIndex(index);
        }}
        style={styles.flatList}
      />

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === currentIndex ? styles.dotActive : styles.dotInactive]}
            />
          ))}
        </View>

        {/* Next / Get Started */}
        <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
          <Text style={styles.nextText}>
            {currentIndex === SLIDES.length - 1 ? 'Get Started' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  skipButton: {
    position: 'absolute',
    top: 56,
    right: 24,
    zIndex: 10,
  },
  skipText: {
    color: Colors.textOnGradientMuted,
    fontSize: 15,
    fontWeight: '500',
  },
  flatList: {
    flex: 1,
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  iconContainer: {
    marginBottom: 40,
  },
  title: {
    color: Colors.textOnGradient,
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 34,
  },
  body: {
    color: Colors.textOnGradientMuted,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  bottomBar: {
    paddingHorizontal: 32,
    paddingBottom: 24,
    paddingTop: 16,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: Colors.textOnGradient,
    width: 24,
  },
  dotInactive: {
    backgroundColor: Colors.textOnGradientMuted,
  },
  nextButton: {
    backgroundColor: Colors.textOnGradient,
    borderRadius: 100,
    paddingVertical: 14,
    alignItems: 'center',
  },
  nextText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
});
