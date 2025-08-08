// Generated test script using DebuggAI's browse-to-test open source project
// visit us at https://debugg.ai for more information
// For docs, see https://github.com/debugg-ai/browse-to-test
// To submit an issue or request a feature, please visit https://github.com/debugg-ai/browse-to-test/issues

// Framework: playwright
// Language: typescript
// This script was automatically generated from sequential browser automation data

        
import { test, expect } from '@playwright/test';

test('landing page should load and be scrollable', async ({ page }) => {
  await page.goto('https://debugg.ai/');

  // Check that the main elements are visible
  const mainHeading = page.locator('h1');
  await expect(mainHeading).toBeVisible();

  const description = page.locator('p');
  await expect(description).toBeVisible();

  // Check for interactive elements like buttons or links
  const getStartedButton = page.locator('a[href*="get-started"], button:has-text("Get Started")');
  const docsButton = page.locator('a[href*="docs"], button:has-text("Documentation")');

  // At least one of these should be visible
  await expect(getStartedButton.or(docsButton)).toBeVisible();

  // Check that the page is scrollable
  const pageHeight = await page.evaluate(() => document.body.scrollHeight);
  const viewportHeight = page.viewportSize()?.height || 0;

  // Page should be taller than the viewport to allow scrolling
  if (pageHeight > viewportHeight) {
    // Try scrolling down and up
    await page.mouse.wheel(0, viewportHeight);
    await page.waitForTimeout(500); // Wait for any potential lazy loading
    await page.mouse.wheel(0, -viewportHeight);
  }
});
