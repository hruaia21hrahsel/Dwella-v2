# Code Conventions & Patterns

## Project Overview

Dwella is a React Native + Expo cross-platform mobile app for property management. The codebase follows TypeScript strict mode with theme-aware UI components using React Native Paper.

---

## TypeScript & Type System

### Type Definitions

- **File**: `lib/types.ts`
- **Pattern**: Exported as top-level `interface` and `type` declarations
- **Naming**: PascalCase (e.g., `User`, `Property`, `PaymentStatus`)
- **Database Models**: Match Supabase table names (snake_case fields)

```typescript
export interface User {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  updated_at: string;
}

export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'confirmed' | 'overdue';
```

### Union Types & Enums

- Use `type` for discriminated unions
- Status fields use literal string unions (not enums)
- Maintain ordering: common → advanced (e.g., `pending` first, `confirmed` last)

---

## File & Folder Organization

### Root Directories

```
.
├── app/                    # Expo Router screens
├── components/             # Reusable UI components
├── constants/              # Config & theme constants
├── hooks/                  # Custom React hooks
├── lib/                    # Utilities, types, state
├── supabase/               # Edge Functions & migrations
└── .planning/codebase/     # Documentation
```

### Naming Conventions

| Category | Pattern | Example |
|----------|---------|---------|
| Components | PascalCase | `PropertyCard.tsx`, `PaymentStatusBadge.tsx` |
| Hooks | camelCase with `use` prefix | `useProperties.ts`, `usePayments.ts` |
| Utils/Libraries | camelCase | `supabase.ts`, `payments.ts` |
| Constants | UPPER_CASE or camelCase | `PROPERTY_COLORS`, `SUPABASE_URL` |
| Routes | kebab-case (Expo Router) | `[id]/tenant/[tenantId]/index.tsx` |
| Types/Interfaces | PascalCase | `UsePaymentsResult`, `PropertyCardProps` |

---

## Component Architecture

### Functional Components

All components are functional with hooks. No class components.

```typescript
interface ComponentProps {
  property: Property;
  onPress?: () => void;
}

export function PropertyCard({ property, onPress }: ComponentProps) {
  const { colors } = useTheme();

  return (
    <View style={{ backgroundColor: colors.background }}>
      {/* JSX */}
    </View>
  );
}
```

### Props Interfaces

- Suffix: `Props`
- Pattern: Always define a separate `interface ComponentNameProps`
- Optional props: Use `?` (e.g., `onPress?: () => void`)
- No prop drilling: Pass callback references, not implementations

```typescript
interface PaymentStatusBadgeProps {
  status: PaymentStatus;
  compact?: boolean;
}

export function PaymentStatusBadge({ status, compact = false }: PaymentStatusBadgeProps) {
  // ...
}
```

### Styling

- **Pattern**: `StyleSheet.create()` at component end
- **Theme Access**: `useTheme()` hook for colors/shadows/spacing
- **Responsive**: Use `Dimensions.get('window')` for calculations
- **No inline styles**: Avoid style objects in JSX except for dynamic values

```typescript
const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    marginBottom: 12,
  },
});
```

### Hooks Integration

- Theme: `const { colors, shadows, spacing } = useTheme()`
- State management: `useAuthStore()` for auth/onboarding
- Custom hooks: `useProperties()`, `usePayments()`, etc. return typed results

---

## State Management

### Zustand Store

**File**: `lib/store.ts`

- Use `create()` with middleware: `persist` for AsyncStorage
- State interfaces: Define `Interface extends AuthState`
- Selector usage: `useAuthStore((s) => s.field)`
- Partialize: Only persist necessary state (e.g., `themeMode`, `onboardingCompletedByUser`)

```typescript
interface AuthState {
  session: Session | null;
  user: User | null;
  setSession: (session: Session | null) => void;
  setUser: (user: User | null) => void;
  isOnboardingCompleted: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // state & actions
    }),
    {
      name: 'dwella-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ /* only these fields */ }),
    }
  )
);
```

---

## Custom Hooks

### Hook Structure

**File**: `hooks/useHookName.ts`

```typescript
interface UseHookNameResult {
  data: DataType[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useHookName(param?: string): UseHookNameResult {
  const [data, setData] = useState<DataType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    // logic
  }, [param]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // Realtime subscription
  useEffect(() => {
    if (!param) return;
    const channel = supabase.channel(...).on(...).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [param, fetch]);

  return { data, isLoading, error, refresh: fetch };
}
```

### Return Interface Pattern

- Always define a `UseHookNameResult` interface
- Include: `isLoading`, `error`, `refresh()`, and data
- Use `??` for null coalescing on Supabase responses

---

## Data Fetching & Supabase

### Query Pattern

```typescript
const { data, error: fetchError } = await supabase
  .from('table')
  .select('*')
  .eq('column', value)
  .order('created_at', { ascending: false });

if (fetchError) throw fetchError;
setData((data as DataType[]) ?? []);
```

### Error Handling

- Supabase client returns `{ data, error }` tuple
- Check `if (error) throw error` or log individually
- Catch blocks: `catch (err: any) => setError(err.message ?? 'Fallback message')`
- Display via toast: `useToastStore.getState().showToast(message, 'error')`

### Realtime Subscriptions

- Channel naming: `table-{id}` or `table` for global
- Cleanup: Always unsubscribe in `useEffect` cleanup
- Callback: Trigger `fetch()` on changes

```typescript
const channel = supabase
  .channel(`payments-${tenant.id}`)
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'payments',
      filter: `tenant_id=eq.${tenant.id}`,
    },
    () => { fetch(); }
  )
  .subscribe();

return () => { supabase.removeChannel(channel); };
```

---

## Validation & Error Handling

### Form Validation

- Return `boolean` from validate function
- Build error object: `Record<string, string>`
- Display per-field: `<HelperText>{errors.field}</HelperText>`

```typescript
function validate(): boolean {
  const errs: Record<string, string> = {};
  if (!name.trim()) errs.name = 'Name is required.';
  setErrors(errs);
  return Object.keys(errs).length === 0;
}

if (!validate()) return;
// proceed with submit
```

### User Feedback

- **Errors**: Toast with `useToastStore().showToast(msg, 'error')`
- **Success**: Toast with `'success'` type
- **Loading**: State boolean with disabled button/spinner

### Soft Deletes

- Pattern: Set `is_archived = TRUE` (never hard delete)
- Queries: Always filter `WHERE is_archived = FALSE`
- Cascade: Archiving a property archives its tenants

---

## Theming System

### Theme Access

```typescript
const { colors, gradients, shadows, spacing, typography, isDark } = useTheme();
```

### Theme Colors

- **Primary**: Brand indigo (`#4F46E5`)
- **Status**: `statusPending`, `statusPartial`, `statusPaid`, `statusConfirmed`, `statusOverdue`
- **Surfaces**: `background`, `surface`, `surfaceElevated`
- **Text**: `textPrimary`, `textSecondary`, `textDisabled`, `textOnPrimary`
- **Functional**: `success`, `warning`, `error`, `info`

### Dark Mode Support

- Use `isDark` flag for conditional styles
- Utility: `adjustPropertyColor(color, isDark)` lightens property colors on dark mode
- All components must respect theme colors (never hardcode)

---

## Constants & Configuration

### Config File

**File**: `constants/config.ts`

```typescript
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const BOT_MODEL = 'claude-sonnet-4-20250514';
export const AUTO_CONFIRM_HOURS = 48;
export const REMINDER_DAYS_BEFORE = 3;
```

### Color Definitions

**File**: `constants/theme.ts` (primary source of truth)

- Re-exported from `constants/colors.ts` for backward compatibility
- Theme-aware: Light & Dark theme objects define colors

---

## Analytics & Logging

### Event Tracking

**File**: `lib/analytics.ts`

```typescript
export const EVENTS = {
  SIGNUP_COMPLETED: 'signup_completed',
  PROPERTY_CREATED: 'property_created',
  PAYMENT_CONFIRMED: 'payment_confirmed',
} as const;

const track = useTrack();
track(EVENTS.PROPERTY_CREATED, { propertyId: id });
```

### Tracking Hook

```typescript
export function useTrack() {
  const posthog = usePostHog();
  return useCallback(
    (event: string, properties?: Record<string, any>) => {
      posthog.capture(event, properties);
    },
    [posthog],
  );
}
```

---

## Naming Patterns by Domain

### Payment-Related

- `PaymentStatus` type for union
- `getStatusColor(status)` returns hex color
- `getStatusLabel(status)` returns human-readable label
- `canMarkAsPaid(status)` for state machine validation
- `getDueDate(year, month, dueDay)` for rent cycle math

### Property Management

- `onboardingCompletedByUser: Record<string, boolean>` for multi-account state
- Dual-role: `ownedProperties` vs `tenantProperties`
- Archive flag: `is_archived` with cascade logic

### Utilities

- **Formatting**: `formatCurrency()`, `formatDate()`, `getMonthName()`
- **Dates**: `getCurrentMonthYear()` returns `{ month, year }`
- **Ordinals**: `getOrdinal(n)` returns "1st", "2nd", etc.
- **UUID**: `randomUUID()` for one-time tokens

---

## Imports & Path Aliases

### Alias Configuration

**File**: `tsconfig.json`

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

### Import Order

1. React & React Native standard library
2. Third-party libraries (zustand, supabase, etc.)
3. Local lib imports (`@/lib/...`)
4. Local component imports (`@/components/...`)
5. Local hook imports (`@/hooks/...`)
6. Local constant imports (`@/constants/...`)

```typescript
import { useState } from 'react';
import { View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { PropertyCard } from '@/components/PropertyCard';
import { useProperties } from '@/hooks/useProperties';
import { Colors } from '@/constants/colors';
```

---

## Comments & Documentation

### Inline Comments

- Explain **why**, not what
- JSDoc for public APIs

```typescript
/**
 * Adjust a property accent color for visibility on dark backgrounds.
 * On dark mode, lightens the color; on light mode, returns as-is.
 */
export function adjustPropertyColor(color: string, isDark: boolean): string {
  if (!isDark) return color;
  // ... implementation
}
```

### TODO & FIXME

- Format: `// TODO: description` or `// FIXME: issue`
- Include context if non-obvious
- Don't leave indefinitely; track in GitHub issues

---

## Code Style

### Formatting

- **Indentation**: 2 spaces
- **Line length**: Prefer <120 characters
- **Trailing commas**: Always use in multi-line objects/arrays
- **Semicolons**: Always (enforced by TypeScript)

### Variable Declaration

- Use `const` by default, `let` only if necessary
- Avoid `var`
- Declare one per line for clarity

```typescript
const isLoading = state.loading;
const hasError = error !== null;
const { colors } = useTheme();
```

### Ternary & Conditionals

- Keep ternaries short and readable
- Multi-condition: Use `&&` for boolean checks
- Destructure parameters

```typescript
// Good
const status = isPaid ? 'Paid' : 'Pending';
const color = isDark && isOverdue ? colors.error : colors.statusOverdue;

// Avoid
const status = isPaid && isConfirmed ? 'Confirmed' : isPaid ? 'Paid' : 'Pending';
```

### Function Declarations

- Use function expressions (`const fn = () => {}`) for consistency
- Arrow functions for callbacks
- Named functions for exports

```typescript
export function useProperties(): UsePropertiesResult {
  // ...
}

const handlePress = () => { /* ... */ };
```

---

## Platform Considerations

### React Native Specifics

- Import from `react-native` for base components (`View`, `Text`, `StyleSheet`)
- Use `react-native-paper` for Material Design components
- Icons: `@expo/vector-icons` (MaterialCommunityIcons)
- Platform-specific code: `Platform.OS === 'web'` checks

### Web Support

```typescript
const authStorage =
  Platform.OS === 'web'
    ? typeof window !== 'undefined'
      ? window.localStorage
      : undefined
    : AsyncStorage;
```

---

## Performance Optimization

### Hooks & Dependencies

- Include all external dependencies in `useEffect` dependency arrays
- Use `useCallback` for functions passed to children
- Memoize expensive computations with `useMemo`

```typescript
const fetch = useCallback(async () => {
  // logic
}, [user, propertyRefreshAt]); // all deps included
```

### Component Re-renders

- Props interfaces: Use specific types, not `any`
- Avoid recreating objects/arrays in render
- Spread operators for shallow copies only

---

## Anti-Patterns

### Don't

- ❌ Use `any` type (strict mode forbids)
- ❌ Hardcode colors (use `useTheme()`)
- ❌ Async operations without error boundaries
- ❌ Inline styling for reusable elements
- ❌ Skip null checks on optional fields
- ❌ Force-push to `main` branch
- ❌ Commit without meaningful message
- ❌ Hard-delete data (use soft delete pattern)

### Do

- ✅ Define explicit types & interfaces
- ✅ Handle errors with try-catch or `.catch()`
- ✅ Use StyleSheet for component styles
- ✅ Add error states to hooks
- ✅ Test null/undefined with `??` or `?.`
- ✅ Commit frequently with clear messages
- ✅ Filter archived items in queries
- ✅ Use theme context for colors

---

## Git & Commit Conventions

### Commit Message Format

```
<type>: <short summary>

[optional body]

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

### Types

- `feat:` New feature
- `fix:` Bug fix
- `refactor:` Restructure without behavior change
- `chore:` Dependencies, config, non-code
- `style:` Formatting only
- `docs:` Documentation

### Examples

```
feat: add property color customization
fix: correct payment state machine for overdue transitions
refactor: extract payment status logic to lib/payments
chore: update Supabase migrations
```

---

## Summary Table

| Aspect | Convention | Example |
|--------|-----------|---------|
| Components | PascalCase | `PropertyCard.tsx` |
| Hooks | use + camelCase | `useProperties.ts` |
| Types | PascalCase | `PaymentStatus`, `PropertyCardProps` |
| Constants | UPPER_CASE | `SUPABASE_URL`, `AUTO_CONFIRM_HOURS` |
| Functions | camelCase | `formatCurrency()`, `getDueDate()` |
| Error handling | setError state + toast | `useToastStore().showToast(msg, 'error')` |
| Theme | useTheme() hook | `const { colors } = useTheme()` |
| State | Zustand store | `useAuthStore()` |
| DB queries | try-catch + error check | `if (fetchError) throw fetchError` |
| Soft delete | is_archived flag | `WHERE is_archived = FALSE` |
