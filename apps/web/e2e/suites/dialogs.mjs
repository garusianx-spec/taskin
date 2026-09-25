import { base, check, finish, launch, out, watchConsole } from '../lib/harness.mjs';
const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
watchConsole(page);
const rail = page.getByRole('navigation', { name: 'ناوبری اصلی' });
await page.goto(base + '/feed', { waitUntil: 'networkidle' });

// Quick create: each item opens its dialog
const items = [
  ['وظیفه جدید', 'تعریف وظیفه جدید'],
  ['گفتگوی جدید', 'گفتگوی جدید'],
  ['رویداد تقویم', 'رویداد تقویم'],
  ['دعوت همکار', 'دعوت همکار'],
];
for (const [item, title] of items) {
  await rail.getByRole('button', { name: 'ایجاد سریع' }).click();
  await page.getByRole('menuitem', { name: item }).click();
  const dialog = page.getByRole('dialog', { name: title });
  check(await dialog.isVisible(), `quick create → ${item} opens "${title}"`);
  await page.screenshot({ path: `${out}/o_${item}.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  check(await dialog.count() === 0, `  Escape closes "${title}"`);
  const focused = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
  check(focused === 'ایجاد سریع', `  focus restored to trigger (${focused})`);
}

// Shortcuts
await page.locator('body').click({ position: { x: 700, y: 400 } });
await page.keyboard.press('n');
check(await page.getByRole('dialog', { name: 'تعریف وظیفه جدید' }).isVisible(), 'N opens task composer');
await page.keyboard.press('Escape');
await page.keyboard.press('m');
check(await page.getByRole('dialog', { name: 'گفتگوی جدید' }).isVisible(), 'M opens new chat');
await page.keyboard.press('Escape');

// Create a group conversation → navigates to /chats with it active
await page.keyboard.press('m');
let dialog = page.getByRole('dialog', { name: 'گفتگوی جدید' });
await dialog.getByRole('tab', { name: 'گروه تیمی' }).click();
await dialog.getByRole('button', { name: 'ایجاد گروه' }).click();
check(await dialog.getByText('نام گروه الزامی است.').isVisible(), 'group validation: name required');
await dialog.getByLabel('نام گروه').fill('تیم انتشار نسخه ۳');
await dialog.getByRole('checkbox', { name: 'آرش کاویانی' }).click();
await dialog.getByRole('checkbox', { name: 'پیام صدیقی' }).click();
await dialog.getByRole('button', { name: 'ایجاد گروه' }).click();
await page.waitForURL('**/chats');
await page.waitForTimeout(300);
check(await page.getByRole('region', { name: 'گفتگوی تیم انتشار نسخه ۳' }).isVisible(), 'new group opens in /chats');
await page.screenshot({ path: `${out}/o_group.png` });

// Direct chat to an existing contact reopens it
await page.getByRole('button', { name: 'گفتگوی جدید' }).first().click();
dialog = page.getByRole('dialog', { name: 'گفتگوی جدید' });
await dialog.getByRole('radio', { name: /آرش کاویانی/ }).click();
check(await dialog.getByRole('button', { name: 'باز کردن گفتگو' }).isVisible(), 'existing direct chat detected');
await dialog.getByRole('button', { name: 'باز کردن گفتگو' }).click();
check(await page.getByRole('region', { name: 'گفتگوی آرش کاویانی' }).isVisible(), 'existing direct chat reopened');

// Calendar event from quick create → lands on /calendar
await rail.getByRole('button', { name: 'ایجاد سریع' }).click();
await page.getByRole('menuitem', { name: 'رویداد تقویم' }).click();
dialog = page.getByRole('dialog', { name: 'رویداد تقویم' });
await dialog.getByRole('tab', { name: 'نقطه عطف پروژه' }).click();
await dialog.getByLabel('عنوان').fill('تحویل نسخه بتا به مشتری');
await dialog.getByRole('button', { name: 'ثبت در تقویم' }).click();
await page.waitForURL('**/calendar');
await page.waitForTimeout(300);
check(await page.getByRole('button', { name: /نقطه عطف پروژه: تحویل نسخه بتا/ }).count() >= 1, 'milestone appears on calendar');

// Invite colleagues with chip validation
await rail.getByRole('button', { name: 'ایجاد سریع' }).click();
await page.getByRole('menuitem', { name: 'دعوت همکار' }).click();
dialog = page.getByRole('dialog', { name: 'دعوت همکار' });
const emails = dialog.getByLabel('ایمیل یا شماره موبایل همکاران');
await emails.fill('mina.karimi@rahnama.ir, bad-address, arash.kaviani@rahnama.ir');
await emails.press('Enter');
check(await dialog.getByText('mina.karimi@rahnama.ir').isVisible(), 'valid email became a chip');
check(await dialog.getByRole('alert').getByText('bad-address نه ایمیل معتبر است و نه شماره موبایل.').isVisible(), 'invalid email flagged');
check(await dialog.getByRole('alert').getByText('arash.kaviani@rahnama.ir از قبل عضو سازمان است.').isVisible(), 'existing member flagged');
await page.screenshot({ path: `${out}/o_invite.png` });
await dialog.getByRole('button', { name: 'ارسال دعوت‌نامه' }).click();
await page.goto(base + '/directory', { waitUntil: 'networkidle' });
// (full reload resets state — check live instead via directory button)
await page.getByRole('button', { name: 'دعوت همکار' }).click();
check(await page.getByRole('dialog', { name: 'دعوت همکار' }).isVisible(), 'directory invite button opens dialog');
await page.keyboard.press('Escape');

// Profile popover actions
const avatar = rail.getByRole('button', { name: /حساب کاربری/ });
await avatar.click();
await page.getByRole('menuitem', { name: 'پروفایل من' }).click();
dialog = page.getByRole('dialog', { name: 'پروفایل من' });
check(await dialog.isVisible(), 'پروفایل من opens profile dialog');
await dialog.getByRole('radio', { name: /مشغول/ }).click();
await dialog.getByRole('button', { name: 'در جلسه' }).click();
await page.screenshot({ path: `${out}/o_profile.png` });
await dialog.getByRole('button', { name: 'ذخیره تغییرات' }).click();
check(await rail.getByRole('button', { name: /مشغول/ }).count() === 1, 'presence saved and reflected on rail avatar');

await avatar.click();
await page.getByRole('menuitem', { name: 'امنیت و ورود' }).click();
dialog = page.getByRole('dialog', { name: 'امنیت و ورود' });
check(await dialog.isVisible(), 'امنیت و ورود opens security dialog');
await dialog.getByLabel('رمز عبور فعلی').fill('old-pass-1');
await dialog.getByLabel('رمز عبور جدید', { exact: true }).fill('short');
await dialog.getByLabel('تکرار رمز عبور جدید').fill('short');
await dialog.getByRole('button', { name: 'به‌روزرسانی رمز عبور' }).click();
check(await dialog.getByText(/دست‌کم ۸ نویسه/).isVisible(), 'short password rejected');
await dialog.getByLabel('رمز عبور جدید', { exact: true }).fill('N3w-Strong-Pass!');
await dialog.getByLabel('تکرار رمز عبور جدید').fill('N3w-Strong-Pass!');
await dialog.getByRole('button', { name: 'به‌روزرسانی رمز عبور' }).click();
check(await dialog.getByText('رمز عبور با موفقیت تغییر کرد.').isVisible(), 'password change succeeds');
await dialog.getByRole('switch', { name: 'ورود دومرحله‌ای با پیامک' }).click();
check((await dialog.getByRole('switch', { name: 'ورود دومرحله‌ای با پیامک' }).getAttribute('aria-checked')) === 'true', '2FA toggled on');
await dialog.getByRole('button', { name: 'خروج از همه نشست‌های دیگر' }).click();
check(await dialog.getByRole('button', { name: /خروج از نشست/ }).count() === 0, 'other sessions revoked');
await page.screenshot({ path: `${out}/o_security.png` });
await dialog.getByRole('button', { name: 'بستن' }).last().click();

// Close button on the popover
await avatar.click();
await page.getByRole('dialog', { name: 'حساب کاربری' }).getByRole('button', { name: 'بستن' }).click();
check(await page.getByRole('dialog', { name: 'حساب کاربری' }).count() === 0, 'popover بستن closes it');

// Sign out
await avatar.click();
await page.getByRole('menuitem', { name: 'خروج از حساب' }).click();
dialog = page.getByRole('dialog', { name: 'خروج از حساب کاربری' });
await dialog.getByRole('button', { name: 'خروج از حساب' }).click();
await page.waitForURL('**/signed-out');
check(await page.getByRole('heading', { name: 'از حساب خود خارج شدید' }).isVisible(), 'signed-out screen shown');
await page.screenshot({ path: `${out}/o_signedout.png` });
await finish(browser);
