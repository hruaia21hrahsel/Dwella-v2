import { useState, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { signInWithGoogle, signInWithApple, isAppleSignInAvailable } from '@/lib/social-auth';
import { useTheme } from '@/lib/theme-context';

interface SocialAuthButtonsProps {
  onError: (message: string) => void;
  onLoading?: (loading: boolean) => void;
  disabled?: boolean;
}

export function SocialAuthButtons({ onError, onLoading, disabled }: SocialAuthButtonsProps) {
  const { colors, isDark } = useTheme();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(true);

  useEffect(() => {
    isAppleSignInAvailable().then(setAppleAvailable);
  }, []);

  const isLoading = googleLoading || appleLoading;

  async function handleGoogle() {
    try {
      setGoogleLoading(true);
      onLoading?.(true);
      const result = await signInWithGoogle();
      if (!result.success) {
        // User cancelled — not an error
      }
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
      if (!result.success) {
        // User cancelled
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
            <GoogleIcon />
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

/** Inline Google "G" icon using the official brand colors */
function GoogleIcon() {
  return (
    <View style={styles.googleIcon}>
      <Text style={styles.googleG}>G</Text>
    </View>
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
  googleIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleG: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    marginTop: -1,
  },
});
