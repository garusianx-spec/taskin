import tseslint from 'typescript-eslint';

/**
 * Lint config for the framework-free workspace packages. `apps/web` has its own config
 * (Next.js rules) and ESLint picks the nearest one, so the two never mix.
 */
export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'apps/**'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
    },
  },
);
