// Generated test script using DebuggAI's browse-to-test open source project
// visit us at https://debugg.ai for more information
// For docs, see https://github.com/debugg-ai/browse-to-test
// To submit an issue or request a feature, please visit https://github.com/debugg-ai/browse-to-test/issues

// Framework: playwright
// Language: typescript
// This script was automatically generated from sequential browser automation data

        
import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('https://playwright.dev/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Playwright/);
});

test('get started link', async ({ page }) => {
  await page.goto('https://playwright.dev/');

  // Click the get started link.
  await page.getByRole('link', { name: 'Get started' }).click();

  // Expects page to have a heading with the name of Installation.
  await expect(page.getByRole('heading', { name: 'Installation' })).toBeVisible();
});
