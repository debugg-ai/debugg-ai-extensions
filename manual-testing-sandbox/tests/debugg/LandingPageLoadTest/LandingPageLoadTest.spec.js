// Generated test script using DebuggAI's browse-to-test open source project
// visit us at https://debugg.ai for more information
// For docs, see https://github.com/debugg-ai/browse-to-test
// To submit an issue or request a feature, please visit https://github.com/debugg-ai/browse-to-test/issues

// Framework: playwright
// Language: typescript
// This script was automatically generated from sequential browser automation data

        
import { test, expect } from '@playwright/test';

test('landing page should load', async ({ page }) => {
  await page.goto('https://github.com/err-ai/err');
  await expect(page.getByText('Debug Smarter, Ship Faster.')).toBeVisible();
  await expect(page.getByText('Err is an AI-powered error analysis and debugging tool that helps developers identify, understand, and fix errors quickly.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Get Started' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Documentation' })).toBeVisible();
});
