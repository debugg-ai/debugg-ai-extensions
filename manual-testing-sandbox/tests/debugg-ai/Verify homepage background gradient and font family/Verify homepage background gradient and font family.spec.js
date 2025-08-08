// Generated test script using DebuggAI's browse-to-test open source project
// visit us at https://debugg.ai for more information
// For docs, see https://github.com/debugg-ai/browse-to-test
// To submit an issue or request a feature, please visit https://github.com/debugg-ai/browse-to-test/issues

// Framework: playwright
// Language: typescript
// This script was automatically generated from sequential browser automation data

        
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('https://fca26739-15ec-4684-9720-30e2503e05f7.ngrok.debugg.ai/');
  await expect(page).toHaveURL('https://fca26739-15ec-4684-9720-30e2503e05f7.ngrok.debugg.ai/');
});

test('Homepage background and font verification', async ({ page }) => {
  // Verify page is visible
  await expect(page.locator('body')).toBeVisible();

  // Verify background gradient in light mode
  const background = await page.evaluate(() => {
    const el = document.querySelector('body');
    return window.getComputedStyle(el).backgroundImage;
  });
  console.log('Background:', background);
  // Expect gradient to contain blue and purple colors
  await expect(background).toContain('linear-gradient');

  // Verify font family
  const fontFamily = await page.evaluate(() => {
    const el = document.querySelector('body');
    return window.getComputedStyle(el).fontFamily;
  });
  console.log('Font Family:', fontFamily);
  // Expect font to be sans-serif
  await expect(fontFamily).toContain('sans-serif');
});
