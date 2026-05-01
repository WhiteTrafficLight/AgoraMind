import { test, expect } from '@playwright/test';

/**
 * Smoke tests for public, no-auth pages.
 *
 * Goal: catch the "did this big refactor silently break a route" class
 * of regressions. Doesn't require the Python backend to be running.
 *
 * Run with `npm run test:e2e` after a one-time
 * `npx playwright install chromium`.
 */

test.describe('public pages render', () => {
  test('home shows the AgoraMind hero', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('AgoraMind').first()).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /Virtual Restoration of the Ancient Agora/i }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /Debate with Philosophers/i })).toBeVisible();
  });

  test('login page renders the auth form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /Login/i })).toBeVisible();
    await expect(page.getByLabel(/Email/i)).toBeVisible();
    await expect(page.getByLabel(/Password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
    // Sign-up link is what register-flow regression broke historically.
    await expect(page.getByRole('link', { name: /Sign up/i })).toHaveAttribute('href', '/register');
  });

  test('register page renders the signup form', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: /Sign Up/i })).toBeVisible();
    await expect(page.getByLabel(/Username/i)).toBeVisible();
    await expect(page.getByLabel(/Email/i)).toBeVisible();
    await expect(page.getByLabel(/^Password$/i)).toBeVisible();
    await expect(page.getByLabel(/Confirm Password/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /Log in|Login/i })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  test('login -> register navigation works (route constants intact)', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: /Sign up/i }).click();
    await expect(page).toHaveURL(/\/register$/);
    await page.getByRole('link', { name: /Log in|Login/i }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
