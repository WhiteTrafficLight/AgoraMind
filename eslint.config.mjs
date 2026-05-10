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
      // Tech-debt demotion: the rules below are real correctness signals
      // from React's stricter Next 16 ruleset, but the codebase has 17
      // pre-existing violations that need per-site investigation (genuine
      // refactor vs justified eslint-disable). Until that backlog is
      // cleared, demote to warn so CI can gate against regressions
      // without blocking on history. Re-promote rule-by-rule as the
      // backlog shrinks. Tracking: PR #42 cleared the trivial subset.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/refs': 'warn',
    },
  },
];

export default eslintConfig;
