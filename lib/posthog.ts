export { PostHogProvider, usePostHog } from 'posthog-react-native';

/**
 * PostHog configuration.
 * Set EXPO_PUBLIC_POSTHOG_API_KEY in your .env file.
 */
export const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? '';
export const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';
