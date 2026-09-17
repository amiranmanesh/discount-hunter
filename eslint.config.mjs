import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: [
      '.next/**',
      'dist/**',
      '.preview/**',
      'probe-out/**',
      'next-env.d.ts',
      'coverage/**',
      'node_modules/**',
      'public/icons/**',
      // Tooling packs vendored into the working copy; not this project's source.
      '.claude/**',
      '.agents/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Everything that renders: the App Router tree and the components it pulls
    // in. Route handlers under `app/api/**` are narrowed to Node below.
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
    },
  },
  {
    // Server-only code: the proxy routes and the shared modules behind them.
    files: ['app/api/**/*.ts', 'src/server/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    // The service worker runs in its own global scope, with none of the DOM.
    files: ['public/sw.js'],
    languageOptions: { globals: { ...globals.serviceworker, ...globals.browser } },
  },
  {
    // Build scripts run in Node, but the Playwright ones also carry callbacks
    // that are serialised into a page, so both global sets apply.
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: { 'no-console': 'off' },
  },
  {
    files: ['tests/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
);
