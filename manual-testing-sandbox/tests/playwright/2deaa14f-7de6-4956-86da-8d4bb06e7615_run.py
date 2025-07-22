import asyncio
import json
import os
import sys
from pathlib import Path
import urllib.parse
from playwright.async_api import async_playwright, Page, BrowserContext
from dotenv import load_dotenv

# Load environment variables
load_dotenv(override=True)

SENSITIVE_DATA = {}


# --- Helper Functions (from playwright_script_helpers.py) ---
from playwright.async_api import Page


# --- Helper Function for Replacing Sensitive Data ---
def replace_sensitive_data(text: str, sensitive_map: dict) -> str:
	"""Replaces sensitive data placeholders in text."""
	if not isinstance(text, str):
		return text
	for placeholder, value in sensitive_map.items():
		replacement_value = str(value) if value is not None else ''
		text = text.replace(f'<secret>{placeholder}</secret>', replacement_value)
	return text


# --- Helper Function for Robust Action Execution ---
class PlaywrightActionError(Exception):
	"""Custom exception for errors during Playwright script action execution."""

	pass


async def _try_locate_and_act(page: Page, selector: str, action_type: str, text: str | None = None, step_info: str = '') -> None:
	"""
	Attempts an action (click/fill) with XPath fallback by trimming prefixes.
	Raises PlaywrightActionError if the action fails after all fallbacks.
	"""
	print(f'Attempting {action_type} ({step_info}) using selector: {repr(selector)}')
	original_selector = selector
	MAX_FALLBACKS = 50  # Increased fallbacks
	# Increased timeouts for potentially slow pages
	INITIAL_TIMEOUT = 10000  # Milliseconds for the first attempt (10 seconds)
	FALLBACK_TIMEOUT = 1000  # Shorter timeout for fallback attempts (1 second)

	try:
		locator = page.locator(selector).first
		if action_type == 'click':
			await locator.click(timeout=INITIAL_TIMEOUT)
		elif action_type == 'fill' and text is not None:
			await locator.fill(text, timeout=INITIAL_TIMEOUT)
		else:
			# This case should ideally not happen if called correctly
			raise PlaywrightActionError(f"Invalid action_type '{action_type}' or missing text for fill. ({step_info})")
		print(f"  Action '{action_type}' successful with original selector.")
		await page.wait_for_timeout(500)  # Wait after successful action
		return  # Successful exit
	except Exception as e:
		print(f"  Warning: Action '{action_type}' failed with original selector ({repr(selector)}): {e}. Starting fallback...")

		# Fallback only works for XPath selectors
		if not selector.startswith('xpath='):
			# Raise error immediately if not XPath, as fallback won't work
			raise PlaywrightActionError(
				f"Action '{action_type}' failed. Fallback not possible for non-XPath selector: {repr(selector)}. ({step_info})"
			)

		xpath_parts = selector.split('=', 1)
		if len(xpath_parts) < 2:
			raise PlaywrightActionError(
				f"Action '{action_type}' failed. Could not extract XPath string from selector: {repr(selector)}. ({step_info})"
			)
		xpath = xpath_parts[1]  # Correctly get the XPath string

		segments = [seg for seg in xpath.split('/') if seg]

		for i in range(1, min(MAX_FALLBACKS + 1, len(segments))):
			trimmed_xpath_raw = '/'.join(segments[i:])
			fallback_xpath = f'xpath=//{trimmed_xpath_raw}'

			print(f'    Fallback attempt {i}/{MAX_FALLBACKS}: Trying selector: {repr(fallback_xpath)}')
			try:
				locator = page.locator(fallback_xpath).first
				if action_type == 'click':
					await locator.click(timeout=FALLBACK_TIMEOUT)
				elif action_type == 'fill' and text is not None:
					try:
						await locator.clear(timeout=FALLBACK_TIMEOUT)
						await page.wait_for_timeout(100)
					except Exception as clear_error:
						print(f'    Warning: Failed to clear field during fallback ({step_info}): {clear_error}')
					await locator.fill(text, timeout=FALLBACK_TIMEOUT)

				print(f"    Action '{action_type}' successful with fallback selector: {repr(fallback_xpath)}")
				await page.wait_for_timeout(500)
				return  # Successful exit after fallback
			except Exception as fallback_e:
				print(f'    Fallback attempt {i} failed: {fallback_e}')
				if i == MAX_FALLBACKS:
					# Raise exception after exhausting fallbacks
					raise PlaywrightActionError(
						f"Action '{action_type}' failed after {MAX_FALLBACKS} fallback attempts. Original selector: {repr(original_selector)}. ({step_info})"
					)

	# This part should not be reachable if logic is correct, but added as safeguard
	raise PlaywrightActionError(f"Action '{action_type}' failed unexpectedly for {repr(original_selector)}. ({step_info})")

# --- End Helper Functions ---
async def run_generated_script():
    global SENSITIVE_DATA
    async with async_playwright() as p:
        browser = None
        context = None
        page = None
        exit_code = 0 # Default success exit code
        try:
            print('Launching chromium browser...')
            browser = await p.chromium.launch(headless=False)
            context = await browser.new_context(permissions=['clipboard-read', 'clipboard-write'], record_video_dir='/app/backend/media/tmp5w1lilj6.gif', no_viewport=True)
            print('Browser context created.')
            # Initial page handling
            if context.pages:
                page = context.pages[0]
                print('Using initial page provided by context.')
            else:
                page = await context.new_page()
                print('Created a new page as none existed.')
            print('\n--- Starting Generated Script Execution ---')

            # --- Step 1 ---
            # Action 1
            await _try_locate_and_act(page, "xpath=//html/body/div/header/div/div[2]/a", "click", step_info="Step 1, Action 1")

            # --- Step 2 ---
            # Action 2
            print(f"Switching to tab with page_id 1 (Step 2, Action 1)")
            if 1 < len(context.pages):
                page = context.pages[1]
                await page.bring_to_front()
                await page.wait_for_load_state('load', timeout=15000)
                await page.wait_for_timeout(500)
            else:
                print(f"  Warning: Tab with page_id 1 not found to switch (Step 2, Action 1)", file=sys.stderr)

            # --- Step 3 ---
            # Action 3
            await _try_locate_and_act(page, "xpath=//html/body/div/header/div/div[2]/a", "click", step_info="Step 3, Action 1")

            # --- Step 4 ---
            # Action 4
            await _try_locate_and_act(page, "xpath=//html/body/div/header/div/div[2]/a", "click", step_info="Step 4, Action 1")

            # --- Step 5 ---
            # Action 5
            await _try_locate_and_act(page, "xpath=//html/body/div/header/div/div[2]/a", "click", step_info="Step 5, Action 1")

            # --- Step 6 ---
            # Action 6
            print(f"Switching to tab with page_id 1 (Step 6, Action 1)")
            if 1 < len(context.pages):
                page = context.pages[1]
                await page.bring_to_front()
                await page.wait_for_load_state('load', timeout=15000)
                await page.wait_for_timeout(500)
            else:
                print(f"  Warning: Tab with page_id 1 not found to switch (Step 6, Action 1)", file=sys.stderr)

            # --- Step 7 ---
            # Action 7
            await _try_locate_and_act(page, "xpath=//html/body/div/header/div/div[2]/a", "click", step_info="Step 7, Action 1")

            # --- Step 8 ---
            # Action 8
            print(f"Switching to tab with page_id 1 (Step 8, Action 1)")
            if 1 < len(context.pages):
                page = context.pages[1]
                await page.bring_to_front()
                await page.wait_for_load_state('load', timeout=15000)
                await page.wait_for_timeout(500)
            else:
                print(f"  Warning: Tab with page_id 1 not found to switch (Step 8, Action 1)", file=sys.stderr)

            # --- Step 9 ---
            # Action 9
            # Unsupported action type: scroll_to_text (Step 9, Action 1)
            # Action 10
            print(f"Waiting for 1 seconds... (Step 9, Action 2)")
            await asyncio.sleep(1)
            # Action 11
            # Invalid action format: {} (Step 9, Action 3)

            # --- Step 10 ---
            # Action 12
            # Invalid action format: {} (Step 10, Action 1)

            # --- Step 11 ---
            # Action 13
            # Invalid action format: {} (Step 11, Action 1)

            # --- Step 12 ---
            # Action 14
            # Invalid action format: {} (Step 12, Action 1)

            # --- Step 13 ---
            # Action 15
            print(f"Waiting for 1 seconds... (Step 13, Action 1)")
            await asyncio.sleep(1)
            # Action 16
            # Unsupported action type: scroll_to_text (Step 13, Action 2)
            # Action 17
            print(f"Waiting for 1 seconds... (Step 13, Action 3)")
            await asyncio.sleep(1)
            # Action 18
            await _try_locate_and_act(page, "xpath=//html/body/div/header/div/div[2]/a", "click", step_info="Step 13, Action 4")
            # Action 19
            print(f"Waiting for 1 seconds... (Step 13, Action 5)")
            await asyncio.sleep(1)
            # Action 20
            await _try_locate_and_act(page, "xpath=//html/body/div/header/div/div[2]/a", "click", step_info="Step 13, Action 6")
            # Action 21
            print(f"Waiting for 1 seconds... (Step 13, Action 7)")
            await asyncio.sleep(1)
            # Action 22
            await _try_locate_and_act(page, "xpath=//html/body/div/header/div/div[2]/a", "click", step_info="Step 13, Action 8")
            # Action 23
            print(f"Waiting for 1 seconds... (Step 13, Action 9)")
            await asyncio.sleep(1)
            # Action 24
            await _try_locate_and_act(page, "xpath=//html/body/div/header/div/div[2]/a", "click", step_info="Step 13, Action 10")

            # --- Step 14 ---
            # Action 25
            print(f"Waiting for 1 seconds... (Step 14, Action 1)")
            await asyncio.sleep(1)
            # Action 26
            # Invalid action format: {} (Step 14, Action 2)

            # --- Step 15 ---
            # Action 27
            # Invalid action format: {} (Step 15, Action 1)

            # --- Step 16 ---
            # Action 28
            # Invalid action format: {} (Step 16, Action 1)

            # --- Step 17 ---
            # Action 29
            # Invalid action format: {} (Step 17, Action 1)

            # --- Step 18 ---
            # Action 30
            print("\n--- Task marked as Done by agent (Step 18, Action 1) ---")
            print(f"Agent reported success: True")
            # Final Message from agent (may contain placeholders):
            final_message = replace_sensitive_data("The 'Sandbox' header on the page at https://7b22fa83-8ad3-460e-8a37-daff4ae668d0.ngrok.debugg.ai has been identified and styled with the new font size, font weight, letter spacing, and color as requested. All steps to locate and apply the style changes have been completed successfully. Task is finished.", SENSITIVE_DATA)
            print(final_message)
        except PlaywrightActionError as pae:
            print(f'\n--- Playwright Action Error: {pae} ---', file=sys.stderr)
            exit_code = 1
        except Exception as e:
            print(f'\n--- An unexpected error occurred: {e} ---', file=sys.stderr)
            import traceback
            traceback.print_exc()
            exit_code = 1
        finally:
            print('\n--- Generated Script Execution Finished ---')
            print('Closing browser/context...')
            if context:
                 try: await context.close()
                 except Exception as ctx_close_err: print(f'  Warning: could not close context: {ctx_close_err}', file=sys.stderr)
            if browser:
                 try: await browser.close()
                 except Exception as browser_close_err: print(f'  Warning: could not close browser: {browser_close_err}', file=sys.stderr)
            print('Browser/context closed.')
            # Exit with the determined exit code
            if exit_code != 0:
                print(f'Script finished with errors (exit code {exit_code}).', file=sys.stderr)
                sys.exit(exit_code)

# --- Script Entry Point ---
if __name__ == '__main__':
    if os.name == 'nt':
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    asyncio.run(run_generated_script())