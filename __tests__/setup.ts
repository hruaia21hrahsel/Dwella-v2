// Mock expo-crypto for tests
jest.mock('expo-crypto', () => ({
  randomUUID: () => '00000000-1111-4222-8333-444444444444',
  getRandomBytes: (length: number) => {
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
    return bytes;
  },
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
}));

// Mock constants/config to avoid requireEnv throwing at import time in tests
jest.mock('@/constants/config', () => ({
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_ANON_KEY: 'test-anon-key',
  TELEGRAM_BOT_USERNAME: '',
  WHATSAPP_BOT_PHONE: '',
  STORAGE_BUCKET: 'payment-proofs',
  DOCUMENTS_BUCKET: 'documents',
  MAINTENANCE_PHOTOS_BUCKET: 'maintenance-photos',
  BOT_MODEL: 'claude-sonnet-4-20250514',
  AUTO_CONFIRM_HOURS: 48,
  REMINDER_DAYS_BEFORE: 3,
  REMINDER_DAYS_AFTER: 3,
}));

// Mock lib/supabase to prevent real Supabase client creation during tests
jest.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(() => Promise.resolve({ data: {}, error: null })),
        remove: jest.fn(() => Promise.resolve({ data: {}, error: null })),
        createSignedUrl: jest.fn(() => Promise.resolve({ data: { signedUrl: 'https://test.url' }, error: null })),
      })),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn(() => Promise.resolve({ data: null, error: null })),
    })),
  },
}));
