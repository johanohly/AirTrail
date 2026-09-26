import { fileURLToPath } from 'node:url';

import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import { importX } from 'eslint-plugin-import-x';
import prettier from 'eslint-plugin-prettier/recommended';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';

const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url));

export default ts.config(
  includeIgnoreFile(gitignorePath),
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs['flat/recommended'],
  ...svelte.configs['flat/prettier'],
  prettier,
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  {
    settings: {
      'import-x/resolver-next': [createTypeScriptImportResolver()],
    },
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2017,
        process: true,
      },
    },
  },
  {
    files: ['**/*.cjs', '**/*.mjs'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parserOptions: {
        extraFileExtensions: ['.svelte'],
        parser: ts.parser,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    rules: {
      'prettier/prettier': ['warn', { endOfLine: 'auto' }],
    },
  },
  {
    rules: {
      'import-x/order': [
        'warn',
        {
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
          'newlines-between': 'always',
        },
      ],
      'import-x/no-unresolved': 'off',
    },
  },
  {
    files: [
      '**/*.js',
      '**/*.ts',
      '**/*.svelte',
      '**/*.svelte.ts',
      '**/*.svelte.js',
      '**/*.tsx',
    ],
  },
);
