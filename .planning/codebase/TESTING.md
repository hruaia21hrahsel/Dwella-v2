# Testing Framework & Patterns

## Current Testing Status

**No test framework currently configured** in this project.

- **TypeScript Checking**: `npx tsc --noEmit` validates types
- **Linting**: None configured
- **Unit Tests**: Not present (`jest` in devDependencies but not set up)
- **Integration Tests**: None
- **E2E Tests**: None

This document outlines recommended testing patterns for future implementation.

---

## Testing Philosophy

For a React Native + Expo app managing financial data:

1. **Type Safety First**: Leverage strict TypeScript instead of tests for obvious errors
2. **Integration > Unit**: Test real Supabase queries and state flows
3. **Component Tests**: Test rendered output and user interactions
4. **Avoid Mock Hell**: Mock external APIs (Supabase auth, Claude API), not business logic

---

## Recommended Stack

```json
{
  "devDependencies": {
    "jest": "^29.0.0",
    "@testing-library/react-native": "^12.0.0",
    "@testing-library/jest-native": "^5.4.0",
    "jest-mock-extended": "^3.0.0",
    "@types/jest": "^29.0.0"
  }
}
```

---

## Test File Structure

### Organization

```
.
├── app/                       # Screens
├── components/
│   ├── PropertyCard.tsx
│   └── PropertyCard.test.tsx  # Co-located test
├── hooks/
│   ├── useProperties.ts
│   └── useProperties.test.ts
├── lib/
│   ├── payments.ts
│   └── payments.test.ts
└── jest.config.js
```

### Naming Convention

- Test files: `ComponentName.test.tsx` or `file.test.ts`
- Describe blocks: Feature-focused
- Test names: Start with verb (describe, should, when)

---

## Jest Configuration

### jest.config.js

```javascript
module.exports = {
  preset: 'react-native',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  collectCoverageFrom: [
    'lib/**/*.ts',
    'hooks/**/*.ts',
    'components/**/*.tsx',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      statements: 70,
      branches: 60,
      functions: 70,
      lines: 70,
    },
  },
};
```

### jest.setup.js

```javascript
// jest.setup.js
import '@testing-library/jest-native/extend-expect';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: jest.fn() },
    from: jest.fn(),
    channel: jest.fn(),
  },
}));
```

---

## Unit Testing Patterns

### Utility Functions

Test pure functions with simple inputs/outputs.

**File**: `lib/utils.ts`

```typescript
// utils.test.ts
describe('formatCurrency', () => {
  it('formats amount as INR with no decimals', () => {
    const result = formatCurrency(1500);
    expect(result).toBe('₹1,500');
  });

  it('rounds large amounts', () => {
    expect(formatCurrency(1500.99)).toBe('₹1,501');
  });

  it('handles zero', () => {
    expect(formatCurrency(0)).toBe('₹0');
  });
});

describe('getOrdinal', () => {
  it('returns correct ordinal suffixes', () => {
    expect(getOrdinal(1)).toBe('1st');
    expect(getOrdinal(2)).toBe('2nd');
    expect(getOrdinal(3)).toBe('3rd');
    expect(getOrdinal(4)).toBe('4th');
    expect(getOrdinal(21)).toBe('21st');
    expect(getOrdinal(22)).toBe('22nd');
  });
});

describe('adjustPropertyColor', () => {
  it('returns color unchanged on light mode', () => {
    expect(adjustPropertyColor('#FF0000', false)).toBe('#FF0000');
  });

  it('lightens dark color on dark mode', () => {
    const result = adjustPropertyColor('#330000', true);
    expect(result).toMatch(/^#[0-9A-F]{6}$/i);
    // Verify it's lighter than original
    const original = parseInt('330000', 16);
    const adjusted = parseInt(result.slice(1), 16);
    expect(adjusted).toBeGreaterThan(original);
  });
});
```

### Payment Status Logic

Test state machine and status transitions.

**File**: `lib/payments.ts`

```typescript
// payments.test.ts
describe('getStatusColor', () => {
  const cases: Array<[PaymentStatus, string]> = [
    ['pending', Colors.statusPending],
    ['partial', Colors.statusPartial],
    ['paid', Colors.statusPaid],
    ['confirmed', Colors.statusConfirmed],
    ['overdue', Colors.statusOverdue],
  ];

  it.each(cases)('returns correct color for %s', (status, expected) => {
    expect(getStatusColor(status)).toBe(expected);
  });
});

describe('canMarkAsPaid', () => {
  it('allows marking pending, partial, or overdue as paid', () => {
    expect(canMarkAsPaid('pending')).toBe(true);
    expect(canMarkAsPaid('partial')).toBe(true);
    expect(canMarkAsPaid('overdue')).toBe(true);
  });

  it('forbids marking paid or confirmed as paid again', () => {
    expect(canMarkAsPaid('paid')).toBe(false);
    expect(canMarkAsPaid('confirmed')).toBe(false);
  });
});

describe('getDueDate', () => {
  it('calculates correct due date for months with >31 days', () => {
    // Jan 31st when due day is 31
    expect(getDueDate(2025, 1, 31)).toBe('2025-01-31');
  });

  it('caps due date at last day of month', () => {
    // Feb 2025 has 28 days, but due day is 31
    expect(getDueDate(2025, 2, 31)).toBe('2025-02-28');
  });

  it('handles leap years', () => {
    // Feb 2024 is leap year (29 days)
    expect(getDueDate(2024, 2, 29)).toBe('2024-02-29');
    // Feb 2025 is not leap year
    expect(getDueDate(2025, 2, 29)).toBe('2025-02-28');
  });
});
```

### Type Safety Tests

Verify type inference and contracts.

```typescript
// lib/types.test.ts
describe('Type definitions', () => {
  it('Payment status is discriminated union', () => {
    const payment: Payment = {
      id: '1',
      status: 'pending',
      amount_due: 1000,
      amount_paid: 0,
      // ... other required fields
    };

    // TypeScript ensures status is one of the allowed values
    const statusKey = payment.status; // Type: PaymentStatus
    expect(['pending', 'partial', 'paid', 'confirmed', 'overdue'])
      .toContain(statusKey);
  });
});
```

---

## Hook Testing Patterns

### Setup & Cleanup

Use `renderHook` from `@testing-library/react-native`.

```typescript
// hooks/useProperties.test.ts
import { renderHook, waitFor } from '@testing-library/react-native';
import { useProperties } from './useProperties';
import { supabase } from '@/lib/supabase';

// Mock Supabase
jest.mock('@/lib/supabase');
const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('useProperties', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches owned and tenant properties', async () => {
    const mockUser = { id: 'user-1' };
    useAuthStore.setState({ user: mockUser });

    // Mock successful response
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: [{ id: 'prop-1', name: 'House 1' }],
            error: null,
          }),
        }),
      }),
    } as any);

    const { result } = renderHook(() => useProperties());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.ownedProperties).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('handles fetch errors gracefully', async () => {
    const mockUser = { id: 'user-1' };
    useAuthStore.setState({ user: mockUser });

    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockRejectedValue(new Error('Network error')),
      }),
    } as any);

    const { result } = renderHook(() => useProperties());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toMatch('Failed to load properties');
  });

  it('returns refresh function', async () => {
    const { result } = renderHook(() => useProperties());
    expect(typeof result.current.refresh).toBe('function');
  });
});
```

### usePayments Hook

```typescript
// hooks/usePayments.test.ts
describe('usePayments', () => {
  const mockTenant = {
    id: 'tenant-1',
    property_id: 'prop-1',
    monthly_rent: 15000,
  } as Tenant;

  it('does not fetch when tenant is null', () => {
    const { result } = renderHook(() => usePayments(null));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.payments).toEqual([]);
  });

  it('fetches and sorts payments by year/month descending', async () => {
    const mockPayments = [
      { id: '1', year: 2025, month: 3, status: 'pending' },
      { id: '2', year: 2025, month: 2, status: 'paid' },
      { id: '3', year: 2025, month: 1, status: 'confirmed' },
    ] as Payment[];

    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockPayments,
              error: null,
            }),
          }),
        }),
      }),
    } as any);

    const { result } = renderHook(() => usePayments(mockTenant));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.payments).toEqual(mockPayments);
  });

  it('sets up realtime subscription for tenant', async () => {
    const { unmount } = renderHook(() => usePayments(mockTenant));

    await waitFor(() => {
      expect(mockSupabase.channel).toHaveBeenCalledWith(
        expect.stringContaining(`payments-${mockTenant.id}`)
      );
    });

    unmount();

    // Verify unsubscribe was called
    expect(mockSupabase.removeChannel).toHaveBeenCalled();
  });
});
```

---

## Component Testing Patterns

### UI Component Tests

Test render output and user interactions.

**File**: `components/PropertyCard.test.tsx`

```typescript
// PropertyCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import { PropertyCard } from './PropertyCard';

describe('PropertyCard', () => {
  const mockProperty = {
    id: '1',
    name: 'My House',
    address: '123 Main St',
    city: 'San Francisco',
    color: '#4F46E5',
    total_units: 2,
  } as Property;

  it('renders property name and address', () => {
    render(
      <ThemeProvider>
        <PropertyCard property={mockProperty} />
      </ThemeProvider>
    );

    expect(screen.getByText('My House')).toBeTruthy();
    expect(screen.getByText(/123 Main St/)).toBeTruthy();
  });

  it('displays TENANT badge when isTenantView is true', () => {
    render(
      <ThemeProvider>
        <PropertyCard property={mockProperty} isTenantView={true} />
      </ThemeProvider>
    );

    expect(screen.getByText('TENANT')).toBeTruthy();
  });

  it('calls onPress when header is touched', () => {
    const onPress = jest.fn();
    render(
      <ThemeProvider>
        <PropertyCard property={mockProperty} onPress={onPress} />
      </ThemeProvider>
    );

    const header = screen.getByText('My House');
    fireEvent.press(header);
    expect(onPress).toHaveBeenCalled();
  });

  it('renders tenant list when provided', () => {
    const tenants = [
      {
        id: 't1',
        tenant_name: 'John Doe',
        flat_no: '1A',
        monthly_rent: 15000,
        invite_status: 'accepted' as const,
      },
    ];

    render(
      <ThemeProvider>
        <PropertyCard property={mockProperty} tenants={tenants} />
      </ThemeProvider>
    );

    expect(screen.getByText('John Doe')).toBeTruthy();
    expect(screen.getByText(/Flat 1A/)).toBeTruthy();
  });

  it('shows "No tenants" when list is empty', () => {
    render(
      <ThemeProvider>
        <PropertyCard property={mockProperty} tenants={[]} />
      </ThemeProvider>
    );

    expect(screen.getByText('No tenants added yet')).toBeTruthy();
  });
});
```

### PaymentStatusBadge Tests

```typescript
// components/PaymentStatusBadge.test.tsx
describe('PaymentStatusBadge', () => {
  it.each<PaymentStatus>([
    'pending',
    'partial',
    'paid',
    'confirmed',
    'overdue',
  ])('renders %s status with correct color', (status) => {
    const { getByText } = render(
      <ThemeProvider>
        <PaymentStatusBadge status={status} />
      </ThemeProvider>
    );

    const label = getByText(status.charAt(0).toUpperCase() + status.slice(1));
    expect(label).toBeTruthy();
  });
});
```

---

## Integration Testing Patterns

### Auth Flow Tests

Test login, signup, and session management.

```typescript
// app/(auth)/login.test.tsx
describe('Login Screen Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user: null, session: null });
  });

  it('completes login flow', async () => {
    const { getByPlaceholderText, getByRole } = render(
      <ThemeProvider>
        <LoginScreen />
      </ThemeProvider>
    );

    const emailInput = getByPlaceholderText('Email');
    const passwordInput = getByPlaceholderText('Password');
    const loginButton = getByRole('button', { name: /sign in/i });

    // Simulate user input
    fireEvent.changeText(emailInput, 'test@example.com');
    fireEvent.changeText(passwordInput, 'password123');

    // Mock successful auth
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: {
        user: { id: 'user-1', email: 'test@example.com' },
        session: { access_token: 'token' },
      },
      error: null,
    });

    fireEvent.press(loginButton);

    await waitFor(() => {
      expect(useAuthStore.getState().user?.email).toBe('test@example.com');
    });
  });

  it('displays error on failed login', async () => {
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid credentials' },
    });

    const { getByText } = render(
      <ThemeProvider>
        <LoginScreen />
      </ThemeProvider>
    );

    fireEvent.press(getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(getByText(/invalid credentials/i)).toBeTruthy();
    });
  });
});
```

### Payment Workflow Tests

```typescript
// app/property/[id]/tenant/[tenantId]/payment/mark-paid.test.tsx
describe('Mark Payment as Paid Workflow', () => {
  it('marks payment as paid and uploads proof', async () => {
    const mockPayment = {
      id: 'payment-1',
      status: 'pending',
      amount_due: 15000,
    } as Payment;

    const { getByText, getByRole } = render(
      <MarkPaidScreen paymentId="payment-1" />
    );

    // Mock payment fetch
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockResolvedValue({
        data: [mockPayment],
        error: null,
      }),
    } as any);

    // User marks as paid
    fireEvent.press(getByRole('button', { name: /mark as paid/i }));

    // Mock storage upload
    mockSupabase.storage.from.mockReturnValue({
      upload: jest.fn().mockResolvedValue({
        data: { path: 'proof.jpg' },
        error: null,
      }),
    } as any);

    // Mock payment update
    mockSupabase.from.mockReturnValue({
      update: jest.fn().mockResolvedValue({
        data: { ...mockPayment, status: 'paid' },
        error: null,
      }),
    } as any);

    await waitFor(() => {
      expect(getByText(/payment marked as paid/i)).toBeTruthy();
    });
  });
});
```

---

## Snapshot Testing

Use snapshots for complex UI layouts with caution.

```typescript
// components/DashboardSkeleton.test.tsx
import renderer from 'react-test-renderer';

describe('DashboardSkeleton', () => {
  it('matches snapshot', () => {
    const tree = renderer
      .create(
        <ThemeProvider>
          <DashboardSkeleton />
        </ThemeProvider>
      )
      .toJSON();

    expect(tree).toMatchSnapshot();
  });
});
```

**Guidelines:**
- Use sparingly for large components
- Review snapshot diffs carefully before updating
- Don't snapshot styling—test with specific property checks

---

## Mocking Patterns

### Supabase Client Mock

```typescript
// __mocks__/lib/supabase.ts
export const supabase = {
  auth: {
    getSession: jest.fn(),
    signInWithPassword: jest.fn(),
    signOut: jest.fn(),
    onAuthStateChange: jest.fn(),
  },
  from: jest.fn(),
  channel: jest.fn(),
  removeChannel: jest.fn(),
  storage: {
    from: jest.fn(),
  },
};
```

### Store Mock

```typescript
// In test setup
import { useAuthStore } from '@/lib/store';

beforeEach(() => {
  useAuthStore.setState({
    user: null,
    session: null,
    isLoading: false,
    themeMode: 'dark',
  });
});
```

### AsyncStorage Mock

Already configured in `jest.setup.js`.

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

// In tests
AsyncStorage.getItem.mockResolvedValue(null);
AsyncStorage.setItem.mockResolvedValue(undefined);
```

---

## Coverage Goals

### By Area

| Area | Target | Rationale |
|------|--------|-----------|
| `lib/` (utils, payments, types) | 85% | Pure business logic |
| `hooks/` (data fetching) | 75% | Complex async flows |
| `components/` (UI) | 60% | Snapshot/render checks |
| `app/` (screens) | 50% | Integration via manual testing |

### Running Coverage

```bash
# Generate coverage report
npm test -- --coverage

# View HTML report
open coverage/lcov-report/index.html
```

---

## Debugging Tips

### Common Issues

| Problem | Solution |
|---------|----------|
| `act()` warning | Wrap async operations in `waitFor()` |
| Mock not working | Ensure `jest.mock()` before import |
| Zustand state not updating | Use `useAuthStore.setState()` in tests |
| Realtime subscription doesn't unsubscribe | Check cleanup function in `useEffect` |

### Debug Output

```typescript
// Print rendered tree
import { render, screen } from '@testing-library/react-native';

render(<Component />);
screen.debug(); // Prints JSX tree

// Inspect specific element
const element = screen.getByText('Label');
console.log(element);
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test -- --coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

---

## Pre-Commit Checks

### husky + lint-staged

```bash
npm install -D husky lint-staged
npx husky install
```

**.husky/pre-commit**:
```bash
#!/bin/sh
npx lint-staged
```

**package.json**:
```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["tsc --noEmit", "jest --bail --findRelatedTests"]
  }
}
```

---

## Summary: Test Priorities

### Phase 1 (MVP)

- ✅ Utility functions (`lib/payments.ts`, `lib/utils.ts`)
- ✅ Type definitions (`lib/types.ts`)
- ✅ Payment state machine logic

### Phase 2 (Core Feature)

- ✅ Custom hooks (`useProperties`, `usePayments`, `useTenants`)
- ✅ Auth flow integration
- ✅ Supabase query patterns

### Phase 3 (Quality)

- ✅ Component render tests
- ✅ User interaction workflows
- ✅ Edge cases & error scenarios

### Phase 4 (Maintenance)

- ✅ Snapshot tests for stable UI
- ✅ Performance benchmarks
- ✅ Accessibility tests

---

## Recommended npm Scripts

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:debug": "node --inspect-brk node_modules/.bin/jest --runInBand",
    "ts-check": "tsc --noEmit",
    "lint": "eslint . --ext .ts,.tsx"
  }
}
```

---

## Additional Resources

- [Testing Library Docs](https://testing-library.com/docs/react-native-testing-library/intro)
- [Jest API](https://jestjs.io/docs/api)
- [Mock Service Worker](https://mswjs.io/) (for API mocking)
- [React Native Testing Pitfalls](https://reactnative.dev/docs/testing-overview)
