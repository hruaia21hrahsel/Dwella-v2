import { Redirect, useLocalSearchParams } from 'expo-router';

// Reuse TenantCreate in edit mode by redirecting with tenantId param
export default function TenantEditScreen() {
  const { id, tenantId } = useLocalSearchParams<{ id: string; tenantId: string }>();
  return <Redirect href={`/property/${id}/tenant/create?tenantId=${tenantId}`} />;
}
