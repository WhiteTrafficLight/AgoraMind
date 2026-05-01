---
name: test-discipline
description: When to run the e2e smoke test. The codebase has minimal test coverage; the smoke test is the primary regression net.
when_to_use: |
  Apply at three checkpoints: before starting a big refactor, after finishing one, and on the first task in a session if the project has been idle for more than a few days.
  Trigger phrases: "refactor", "delete", "rewrite", "move file", "rename", "consolidate", "merge implementations", "I've been away", "coming back to this".
  Do NOT skip the test before merging "small" changes that touch routing, auth, or shared components — small changes are exactly when smoke tests catch silent breakage.
allowed-tools: Bash Read
---

# Test discipline

The AgoraMind frontend has **one** test suite: an e2e smoke test at `e2e/smoke.spec.ts`. It boots the dev server (no Python backend needed) and exercises the public pages.

This skill is about when to run it.

## The rule

```bash
npm run test:e2e
```

Run it at these moments. Do not skip them.

### 1. Before any "big" refactor

A refactor is "big" if it matches any of:

- Touches more than 5 files
- Deletes a file with imports
- Moves a file to a new path
- Renames an exported symbol
- Changes routing (`router.push`, `<Link>`, NextAuth pages)
- Changes auth (`authOptions`, `signIn`, session handling)
- Touches anything under `src/lib/api/`, `src/hooks/use*`, `src/components/ui/Header*`, `src/app/(login|register|chat|open-chat)`
- The user explicitly calls it a "refactor", "rewrite", or "consolidation"

Run the smoke test **before** starting so you have a baseline. If it's red before you change anything, stop and surface that to the user — don't pile new changes on top of an existing regression.

### 2. After finishing the refactor, before opening the PR

After your edits and a clean `npm run build`, run the smoke test. If it fails:

- Read the failure carefully. Don't paper over it by editing the test.
- The test is the spec; if a real intentional behavior change broke an assertion, **update the test in the same PR** with a clear commit message explaining why.
- If the failure is unexplained, surface it to the user before pushing. Don't push red.

### 3. On the first task in a session if the project has been idle

If the user says anything like "I've been away", "coming back to this", "after a long pause", or this is the first message in a fresh conversation and the codebase shows recent inactivity, run:

```bash
npm install        # in case dependencies shifted
npm run test:e2e
```

Green = ground is stable, proceed normally. Red = surface immediately, do not start new work on a broken baseline.

## When NOT to run

The smoke test boots a dev server and takes ~10 seconds. Don't run it for:

- Pure documentation edits (`*.md`)
- Pure dependency version bumps where the user already verified
- Single-line typo fixes outside of imports/routes/auth
- Comments-only changes
- Adjustments to `.gitignore`, `eslint.config.mjs`, or other tooling that has its own validation

## Adding tests as features ship

The current smoke test only covers public pages (`/`, `/login`, `/register`, login↔register navigation). It does **not** cover:

- Chat happy path (depends on Python backend)
- Debate flow
- Authenticated routes
- Socket.IO real-time events

When a new feature ships, add at least one assertion that exercises its primary user path. The bar is not "comprehensive coverage" — it's "this feature has *some* test that would have caught the regression I just made". A 5-line test is better than zero.

If the new feature requires the backend, decide between:

1. **Mock the backend** at the fetch layer (faster, brittle when backend contracts change)
2. **Run the backend in test setup** (slower, more realistic; needs Python + MongoDB + maybe Redis stood up)

Pick once per repo and stick with it. Currently neither is set up — first feature test gets to make this call.

## Browser install

The first time the smoke test runs on a machine, `npx playwright install chromium` is needed (~100MB). The CI workflow at `.github/workflows/smoke.yml` handles this automatically; locally the developer needs to do it once.

If `npm run test:e2e` errors with "Looks like Playwright Test or Playwright was just installed or updated", run:

```bash
npx playwright install chromium
```
