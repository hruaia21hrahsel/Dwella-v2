import { Redirect } from 'expo-router';
import { useAuthStore } from '@/lib/store';

export default function Index() {
  const { session, isLoading } = useAuthStore();

  if (isLoading) return null;

  if (session) {
    return <Redirect href="/(tabs)/properties" />;
  }

  return <Redirect href="/(auth)/login" />;
}
