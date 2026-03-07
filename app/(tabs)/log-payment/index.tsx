import { Redirect } from 'expo-router';

// This screen is never shown directly — the hero tab button in the
// bottom nav bar intercepts all presses and navigates to /(tabs)/payments.
export default function LogPaymentRedirect() {
  return <Redirect href="/(tabs)/payments" />;
}
