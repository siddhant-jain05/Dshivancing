module.exports = {
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.smoke.test.{ts,tsx}'],
  setupFiles: ['<rootDir>/src/__mocks__/setup.ts'],
  moduleNameMapper: {
    '^@/lib/supabase$': '<rootDir>/src/__mocks__/lib/supabase.ts',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^expo-router$': '<rootDir>/src/__mocks__/expo-router.tsx',
    '^react-native-safe-area-context$': '<rootDir>/src/__mocks__/react-native-safe-area-context.ts',
    '^expo-image-picker$': '<rootDir>/src/__mocks__/expo-image-picker.ts',
    '^expo-video-thumbnails$': '<rootDir>/src/__mocks__/expo-video-thumbnails.ts',
    '^react-native$': '<rootDir>/src/__mocks__/react-native.ts',
    '^react-native-vector-icons$': '<rootDir>/src/__mocks__/react-native-vector-icons.ts',
    '^react-native-vector-icons/Ionicons$': '<rootDir>/src/__mocks__/react-native-vector-icons.ts',
  },
  transform: {
    '^.+\\.(js|ts|tsx)$': ['babel-jest', { configFile: './babel.config.js' }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|expo|@expo)/)',
  ],
  testEnvironment: 'node',
  globals: {
    __DEV__: true,
  },
};
