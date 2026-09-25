/**
 * Shared plumbing for the Playwright suites. Each suite is a plain Node script that drives a
 * running production build (`BASE_URL`) and prints one PASS/FAIL line per check. It exits
 * non-zero when any check fails or a watched page logs a console error, warning or uncaught
 * exception, so a noisy page fails as loudly as a broken assertion.
 */
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright-core';

export { devices };

export const base = process.env.BASE_URL ?? 'http://localhost:3100';

/** Screenshots land here (git-ignored); suites write into it with `${out}/name.png`. */
export const out = fileURLToPath(new URL('../out', import.meta.url));
mkdirSync(out, { recursive: true });

let passed = 0;
let failed = 0;
const consoleProblems = [];

export function check(condition, message) {
  if (condition) passed += 1;
  else failed += 1;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${message}`);
}

/** Chromium from `CHROMIUM_PATH` when set (a preinstalled browser), else Playwright's own install. */
export function launch() {
  return chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
}

export function watchConsole(page) {
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      consoleProblems.push(`[${message.type()}] ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => consoleProblems.push(`[pageerror] ${error.message}`));
}

export async function finish(browser) {
  await browser.close();
  for (const problem of consoleProblems) console.log(`CONSOLE ${problem}`);
  console.log(`\n${passed} passed, ${failed} failed, ${consoleProblems.length} console problems`);
  process.exitCode = failed > 0 || consoleProblems.length > 0 ? 1 : 0;
}
