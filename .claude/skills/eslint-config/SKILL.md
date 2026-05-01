---
name: eslint-config
description: ESLint 9 flat config — eslint.config.mjs structure, plugin composition, rule reference.
when_to_use: |
  Apply when writing or modifying eslint.config.mjs, adding lint plugins, debugging lint errors, or fixing flat config migration issues.
  Covers ESLint 9 flat config structure, plugin registration, language options, file-scoped rule overrides, and Next.js + TypeScript rule presets.
  Trigger phrases: "eslint.config", "flat config", "lint error", "lint rule", "no-explicit-any", "exhaustive-deps", ".eslintrc", "linter".
  Do NOT use for styling (see tailwind skill), component logic (see nextjs-react skill), or TypeScript types (see typescript skill).
allowed-tools: Read Grep Glob
---

# ESLint 9 — Flat Config

## Flat Config Structure

```js
// eslint.config.mjs
import js from '@eslint/js'
import ts from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import nextPlugin from '@next/eslint-plugin-next'
import globals from 'globals'

export default ts.config(
  { ignores: ['dist/**', '.next/**', 'node_modules/**'] },
  js.configs.recommended,
  ...ts.configs.strictTypeChecked,
  {
    plugins: {
      'react-hooks': reactHooks,
      '@next/next': nextPlugin,
    },
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { projectService: true },
    },
    rules: {
      // React
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // TypeScript
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-floating-promises': 'error',

      // Next.js
      '@next/next/no-img-element': 'error',
      '@next/next/no-html-link-for-pages': 'error',
    },
  },
  {
    // Relax rules for test files
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
)
```

## Rule Reference

| Rule | Why |
|------|-----|
| `no-explicit-any` | Type safety |
| `consistent-type-imports` | Forces `import type` — tree-shaking friendly |
| `no-floating-promises` | Catches unawaited Promises |
| `exhaustive-deps` | Catches missing useEffect dependencies |
| `no-img-element` | Enforces `<Image />` for Next.js optimization |
| `rules-of-hooks` | Enforces React Hooks call rules |

## File-Scoped Overrides

Use a separate config object with `files: [...]` to scope rules to specific paths:

```js
{
  files: ['**/*.test.ts', '**/*.test.tsx'],
  rules: { '@typescript-eslint/no-explicit-any': 'off' },
},
{
  files: ['scripts/**/*.ts'],
  rules: { 'no-console': 'off' },
}
```

## Disabling Rules Inline

Always include a reason when disabling a rule inline:

```ts
// ✅ With reason
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Third-party API returns untyped JSON
const data: any = await externalApi.fetch()

// ❌ No reason given
// eslint-disable-next-line
const data: any = await externalApi.fetch()
```

---

## Gotchas ⚠️

- **`.eslintrc.*` files are not supported** — only `eslint.config.mjs` works in ESLint 9.
- **No `extends` key** — use `ts.config()` spread or array spread to compose configs.
- **`plugins` must be an object with a name key**: `{ 'react-hooks': reactHooks }` not `[reactHooks]`.
- **No `env` key** — use `languageOptions.globals` with the `globals` package instead.
- **`ignores` must be its own config object** — not inside a config with rules.
- **`projectService: true`** is the modern way to enable type-aware linting (replaces `project: './tsconfig.json'`).

---

## Never Do

- Disable ESLint rules inline without a comment explaining why
- Create `.eslintrc.json` or `.eslintrc.js` — ESLint 9 ignores them silently
- Use `// eslint-disable` (file-wide) when `// eslint-disable-next-line` would do
- Mix `.eslintrc.*` with `eslint.config.mjs` — only the flat config is read
