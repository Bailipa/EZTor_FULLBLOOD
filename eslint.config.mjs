import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react/no-unescaped-entities': 'off',
      'prefer-const': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'deploy/.next/**',
    'deploy/**',
    'release-extract/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'src/_deprecated/**',
    'coverage/**',
  ]),
  {
    files: ['**/__tests__/**/*.ts', '**/__tests__/**/*.tsx', 'scripts/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
])

export default eslintConfig
