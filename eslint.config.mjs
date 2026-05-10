import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescript from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';

const eslintConfig = [
  ...coreWebVitals,
  ...typescript,
  // Must be last: disables formatting rules from the presets above that
  // would conflict with Prettier. Prettier owns whitespace; ESLint owns
  // correctness.
  prettier,
  {
    rules: {
      // Demote unused-vars to warnings so they don't block CI builds.
      // Underscore-prefixed args/caught errors are conventionally unused
      // and excluded from reporting entirely.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_|^(error|err|e)$',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
];

export default eslintConfig;
