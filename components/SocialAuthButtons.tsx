import { useState, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { signInWithGoogle, signInWithApple, isAppleSignInAvailable } from '@/lib/social-auth';
import { useAuthStore } from '@/lib/store';
import { useTheme } from '@/lib/theme-context';

interface SocialAuthButtonsProps {
  onError: (message: string) => void;
  onLoading?: (loading: boolean) => void;
  disabled?: boolean;
}

export function SocialAuthButtons({ onError, onLoading, disabled }: SocialAuthButtonsProps) {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const { onboardingCompleted, setLocked } = useAuthStore();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(true);

  useEffect(() => {
    isAppleSignInAvailable().then(setAppleAvailable);
  }, []);

  const isLoading = googleLoading || appleLoading;

  /** After successful OAuth, navigate immediately — don't wait for AuthGuard. */
  function navigateAfterAuth() {
    setLocked(false);
    router.replace(onboardingCompleted ? '/(tabs)/dashboard' : '/onboarding');
  }

  async function handleGoogle() {
    try {
      setGoogleLoading(true);
      onLoading?.(true);
      const result = await signInWithGoogle();
      if (result.success) {
        navigateAfterAuth();
        return;
      }
      // User cancelled — not an error
    } catch (err: any) {
      onError(err.message || 'Google sign-in failed');
    } finally {
      setGoogleLoading(false);
      onLoading?.(false);
    }
  }

  async function handleApple() {
    try {
      setAppleLoading(true);
      onLoading?.(true);
      const result = await signInWithApple();
      if (result.success) {
        navigateAfterAuth();
        return;
      }
    } catch (err: any) {
      // Error code 1001 = user cancelled on iOS
      if (err.code === 'ERR_REQUEST_CANCELED' || err.code === '1001') return;
      onError(err.message || 'Apple sign-in failed');
    } finally {
      setAppleLoading(false);
      onLoading?.(false);
    }
  }

  return (
    <View style={styles.container}>
      {/* Google button */}
      <TouchableOpacity
        style={[
          styles.socialButton,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#fff',
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
          },
        ]}
        onPress={handleGoogle}
        disabled={disabled || isLoading}
        activeOpacity={0.7}
      >
        {googleLoading ? (
          <ActivityIndicator size="small" color={colors.textSecondary} />
        ) : (
          <>
            <GoogleLogo size={20} />
            <Text style={[styles.socialText, { color: colors.textPrimary }]}>Continue with Google</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Apple button */}
      {appleAvailable && (
        <TouchableOpacity
          style={[
            styles.socialButton,
            {
              backgroundColor: isDark ? '#fff' : '#000',
              borderColor: isDark ? '#fff' : '#000',
            },
          ]}
          onPress={handleApple}
          disabled={disabled || isLoading}
          activeOpacity={0.7}
        >
          {appleLoading ? (
            <ActivityIndicator size="small" color={isDark ? '#000' : '#fff'} />
          ) : (
            <>
              <MaterialCommunityIcons name="apple" size={20} color={isDark ? '#000' : '#fff'} />
              <Text style={[styles.socialText, { color: isDark ? '#000' : '#fff' }]}>
                Continue with Apple
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

function GoogleLogo({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107" />
      <Path d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00" />
      <Path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" fill="#4CAF50" />
      <Path d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 10,
  },
  socialText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
