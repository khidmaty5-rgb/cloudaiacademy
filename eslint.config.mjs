import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const baseDirectory = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory });

const eslintConfig = [
  {
    ignores: [
      '.next/**',
      'build/**',
      'coverage/**',
      'dist/**',
      'functions/**',
      '**/lib/**',
      'node_modules/**',
      'out/**',
      '**/*.min.js',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      'react/no-unescaped-entities': 'warn',
    },
  },
];

export default eslintConfig;
