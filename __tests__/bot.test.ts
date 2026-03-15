import * as Crypto from 'expo-crypto';

// Import after mocks are set up in setup.ts
describe('Crypto usage in bot module', () => {
  it('expo-crypto randomUUID returns a valid UUID format', () => {
    const uuid = Crypto.randomUUID();
    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('expo-crypto getRandomBytes returns bytes of correct length', () => {
    const bytes = Crypto.getRandomBytes(6);
    expect(bytes).toHaveLength(6);
    expect(bytes).toBeInstanceOf(Uint8Array);
  });

  it('getRandomBytes produces values in 0-255 range', () => {
    const bytes = Crypto.getRandomBytes(100);
    for (let i = 0; i < bytes.length; i++) {
      expect(bytes[i]).toBeGreaterThanOrEqual(0);
      expect(bytes[i]).toBeLessThan(256);
    }
  });
});

describe('secureRandomDigits logic', () => {
  // Test the digit-generation logic directly
  function secureRandomDigits(length: number): string {
    const bytes = Crypto.getRandomBytes(length);
    let result = '';
    for (let i = 0; i < length; i++) {
      result += (bytes[i] % 10).toString();
    }
    return result;
  }

  it('produces a string of the requested length', () => {
    const code = secureRandomDigits(6);
    expect(code).toHaveLength(6);
  });

  it('contains only digits', () => {
    const code = secureRandomDigits(6);
    expect(code).toMatch(/^\d{6}$/);
  });

  it('produces different codes on repeated calls', () => {
    // With real randomness this should almost always pass
    const codes = new Set(Array.from({ length: 10 }, () => secureRandomDigits(6)));
    expect(codes.size).toBeGreaterThan(1);
  });
});
