import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      'dist/**',
      'release/**',
      'coverage/**',
      'node_modules/**',
      // Driven-browser profiles and captured API traffic.
      '.browser-profile/**',
      'probe-out/**',
      'recon/**',
    ],
  },
  js.configs.recommended,
  {
    // The extension itself: browser globals plus the WebExtension APIs.
    files: ['extension/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.webextensions },
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Build and tooling scripts run in Node, but the Playwright ones also carry
    // callbacks that are serialised into a page, so both global sets apply.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser, ...globals.webextensions },
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.webextensions },
    },
  },
];
