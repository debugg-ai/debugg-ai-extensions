// Generated test script using DebuggAI's browse-to-test open source project
// visit us at https://debugg.ai for more information
// For docs, see https://github.com/debugg-ai/browse-to-test
// To submit an issue or request a feature, please visit https://github.com/debugg-ai/browse-to-test/issues

// Framework: playwright
// Language: typescript
// This script was automatically generated from sequential browser automation data

        
import { test, expect } from '@playwright/test';

test('landing page should load and scroll correctly', async ({ page }) => {
  await page.goto('http://localhost:3456/');
  
  // Verify page has loaded by checking main elements
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('a[href="/docs"]')).toBeVisible();
  
  // Scroll down the page
  await page.mouse.wheel(0, 1000);
  await page.waitForTimeout(1000); // Wait for any lazy loading
  
  // Scroll back up
  await page.mouse.wheel(0, -1000);
  await page.waitForTimeout(1000);
  
  // Verify interactive elements
  const tryDemoButton = page.locator('a:has-text("Try Demo")');
  await expect(tryDemoButton).toBeVisible();
  
  // Test clicking a main button
  // Note: This might navigate away from the page
  // await tryDemoButton.click();
  
  // If navigation is needed, handle it here
  // await page.goBack();
  
  // Test hover effect on a button
  const getStartedButton = page.locator('a[href="/docs"]').first();
  await getStartedButton.hover();
  
  // Verify button text
  const buttonText = await getStartedButton.textContent();
  expect(buttonText).toContain('Get Started');
});
