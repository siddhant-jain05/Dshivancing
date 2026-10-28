// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const importPlugin = require('eslint-plugin-import');

module.exports = defineConfig([
  expoConfig,
  importPlugin.flatConfigs.recommended,
  {
    ignores: ['dist/*'],
  },
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    rules: {
      'import/named': 'error',
      'import/default': 'error',
      'import/no-unresolved': 'error',
    },
  },
]);
