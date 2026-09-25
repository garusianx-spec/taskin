import { base, check, devices, finish, launch, out, watchConsole } from '../lib/harness.mjs';
const browser = await launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], defaultBrowserType: undefined });
const page = await ctx.newPage();
watchConsole(page);
const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
for (const route of ['/feed', '/tasks', '/calendar', '/notes', '/more', '/directory', '/chats']) {
  await page.goto(base + route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(250);
  const o = await overflow();
  check(o <= 0, `${route}: no horizontal overflow (${o}px)`);
  await page.screenshot({ path: `${out}/m${route.replace('/', '_')}.png` });
}
// tasks: checkbox + completed section
await page.goto(base + '/tasks', { waitUntil: 'networkidle' });
await page.getByRole('checkbox', { name: /تهیه سند معماری/ }).tap();
const completed = page.getByRole('region', { name: 'انجام‌شده' });
check(await completed.getByText('تهیه سند معماری همگام‌سازی آفلاین').isVisible(), 'mobile: checked task moves to completed section');
await page.screenshot({ path: `${out}/m_tasks_checked.png`, fullPage: false });
// top bar quick create + bell
const bar = page.locator('header').first();
await bar.getByRole('button', { name: 'ایجاد سریع' }).tap();
await page.getByRole('menuitem', { name: 'رویداد تقویم' }).tap();
check(await page.getByRole('dialog', { name: 'رویداد تقویم' }).isVisible(), 'mobile: top-bar quick create works');
await page.getByRole('dialog', { name: 'رویداد تقویم' }).getByRole('button', { name: 'انصراف' }).tap();
await bar.getByRole('button', { name: /^اعلان‌ها/ }).tap();
await page.waitForTimeout(300);
const box = await page.getByRole('dialog', { name: 'اعلان‌ها' }).boundingBox();
check(box && box.width >= 380, `mobile: notification drawer full width (${box?.width})`);
await page.screenshot({ path: `${out}/m_notifications.png` });
await page.keyboard.press('Escape');
// calendar: dots open the day summary
await page.goto(base + '/calendar', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /^۳ مورد در/ }).first().tap();
check(await page.getByRole('dialog', { name: /^برنامه/ }).isVisible(), 'mobile: calendar dots open the day summary');
await page.waitForTimeout(250);
await page.screenshot({ path: `${out}/m_calendar_summary.png` });
// notes: list → editor → back
await page.goto(base + '/notes', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /چک‌لیست انتشار نسخه/ }).first().tap();
check(await page.getByRole('textbox', { name: 'عنوان یادداشت' }).isVisible(), 'mobile: note opens editor');
await page.screenshot({ path: `${out}/m_notes_editor.png` });
await page.getByRole('button', { name: 'بازگشت به فهرست یادداشت‌ها' }).tap();
check(await page.getByRole('heading', { name: 'همه یادداشت‌ها' }).isVisible(), 'mobile: back returns to list');
check(await page.getByRole('group', { name: 'فیلتر دسته' }).isVisible(), 'mobile: category chips visible above the list');
await page.getByRole('button', { name: 'دسته‌ها و فیلترها' }).tap();
check(await page.getByRole('navigation', { name: 'دسته‌ها' }).isVisible(), 'mobile: categories panel opens');
// more page account actions
await page.goto(base + '/more', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /امنیت و ورود/ }).tap();
check(await page.getByRole('dialog', { name: 'امنیت و ورود' }).isVisible(), 'mobile: More → security dialog');
await finish(browser);
