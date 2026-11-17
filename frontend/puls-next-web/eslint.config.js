import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'test-results', 'playwright-report'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser }
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // Классические правила хуков: порядок вызова и полнота зависимостей эффектов.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      // Переменные с «_» и остаток при деструктуризации (const { a, ...rest }) — намеренно не используются.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }]
    }
  },
  {
    // В unit-тестах моки контекстов намеренно частичные.
    files: ['src/**/*.test.{ts,tsx}'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' }
  },
  {
    files: ['e2e/**/*.ts', '*.config.ts', 'vite.config.ts'],
    languageOptions: { globals: { ...globals.node } }
  },
  {
    files: ['public/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: { globals: { ...globals.serviceworker } }
  }
);
