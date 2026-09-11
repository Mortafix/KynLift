import { defineConfig } from 'vitest/config';

export default defineConfig({ test: {
  environment: 'node',
  include: ['tests/**/*.test.ts'],
  exclude: [
    ...(!process.env.FIRESTORE_EMULATOR_HOST ? ['tests/firestore.rules.test.ts'] : []),
    ...(!process.env.FIREBASE_AUTH_EMULATOR_HOST ? ['tests/auth.emulator.test.ts'] : []),
  ],
  testTimeout: 15000,
} });
