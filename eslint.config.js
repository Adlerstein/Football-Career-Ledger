import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**', 'data/**'] },
  js.configs.recommended,
  {
    // Plugin runtime: browser + SillyTavern/Luker host globals and card bridges.
    files: ['index.js', 'src/**/*.js', 'examples/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        jQuery: 'readonly',
        toastr: 'readonly',
        triggerSlash: 'readonly',
        SillyTavern: 'readonly',
        Luker: 'readonly',
        chat: 'readonly',
        chat_metadata: 'readonly',
        stat_data: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', {
        args: 'after-used',
        caughtErrors: 'none',
        varsIgnorePattern: '^_',
        argsIgnorePattern: '^_',
      }],
    },
  },
  {
    // Tests and dev scripts run under Node.
    files: ['tests/**/*.js', 'scripts/**/*.mjs', '*.mjs', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
];
