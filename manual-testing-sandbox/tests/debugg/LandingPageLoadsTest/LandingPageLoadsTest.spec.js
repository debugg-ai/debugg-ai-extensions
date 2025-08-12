// Generated test script using DebuggAI's browse-to-test open source project
// visit us at https://debugg.ai for more information
// For docs, see https://github.com/debugg-ai/browse-to-test
// To submit an issue or request a feature, please visit https://github.com/debugg-ai/browse-to-test/issues

// Framework: playwright
// Language: typescript
// This script was automatically generated from sequential browser automation data

        
import { test, expect } from '@playwright/test';

test('landing page should load successfully', async ({ page }) => {
  await page.goto('http://localhost:3456');
  
  // Verify the main heading is visible
  const mainHeading = page.locator('h1', { hasText: 'Debug Smarter, Ship Faster.' });
  await expect(mainHeading).toBeVisible();
  
  // Verify the description text is visible
  const description = page.locator('p', { hasText: 'Debugg is an AI-powered debugging platform that helps developers identify and fix bugs faster.' });
  await expect(description).toBeVisible();
  
  // Verify the primary buttons are visible
  const getStartedButton = page.locator('a[href="/signup"]').first();
  const docsButton = page.locator('a[href="https://docs.debugg.ai"]').first();
  await expect(getStartedButton).toBeVisible();
  await expect(docsButton).toBeVisible();
  
  // Verify the buttons have correct text
  await expect(getStartedButton).toHaveText(/Get Started/i);
  await expect(docsButton).toHaveText(/Documentation/i);
  
  // Verify the buttons are in the viewport
  await expect(getStartedButton).toBeInViewport();
  await expect(docsButton).toBeInViewport();
  
  // Click the 'Get Started' button and verify navigation
  await getStartedButton.click();
  await expect(page).toHaveURL(/signup/);
});
