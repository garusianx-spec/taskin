/**
 * The live app against a running Taskin API: two people, two browsers, one workspace.
 *
 *   API_LOG=/path/to/api.log BASE_URL=http://localhost:3000 npm run test:e2e:live
 *
 * The API must run with the console SMS driver (the default outside production) and log to
 * `API_LOG`: sign-in codes and invitation links are read from there. The web app must be built
 * or served with the live data source (the default), proxying `/api/v1` and `/rt` to that API.
 *
 * Covers: sign-up by SMS code → first workspace → project → invitation by SMS → the invitee
 * joins through the link → a task created, assigned and completed by one person appears and
 * moves live for the other → a direct chat with live delivery, typing, read receipts and
 * reactions (❤️, 👎) → notification quick views and "mark all read" persisted → the profile
 * menu signs out and the session stays gone after a reload. Any console error or warning —
 * hydration mismatches included — fails the run.
 */
import { readFileSync, statSync } from 'node:fs';
import { base, check, eventually, finish, launch, out, visible, watchConsole } from '../lib/harness.mjs';

const apiLog = process.env.API_LOG;
if (!apiLog) {
  console.error('Set API_LOG to the file the API logs to: the console SMS driver writes sign-in codes and invitation links there.');
  process.exit(2);
}

const OTP = /"text":"کد ورود شما به تسکین: (\d{6})"/g;
const INVITE = /"text":"[^"]*?(https?:\/\/[^"\s]+\/invite\?token=[^"\s]+)"/g;
const runId = String(Date.now()).slice(-4);
const phoneOf = () => `0912${String(Math.floor(Math.random() * 9_000_000) + 1_000_000)}`;
const ownerPhone = phoneOf();
let guestPhone = phoneOf();
while (guestPhone === ownerPhone) guestPhone = phoneOf();
const ownerName = `سحر آزمون ${runId}`;
const guestName = `علی آزمون ${runId}`;
const workspaceName = `فضای آزمون ${runId}`;
const projectName = 'بازطراحی اپلیکیشن';
const taskTitle = `بازبینی جریان ورود ${runId}`;

const logSize = () => statSync(apiLog).size;

/** The newest SMS matching `pattern` written to the API log after byte `from`. */
async function smsAfter(from, pattern, what) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const text = readFileSync(apiLog).subarray(from).toString('utf8');
    const match = [...text.matchAll(pattern)].at(-1);
    if (match?.[1]) return match[1];
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`No ${what} in ${apiLog} within 20 s.`);
}

/** Phone → code → (new accounts) name. */
async function signIn(page, phone, fullName) {
  const phoneBox = page.getByRole('textbox', { name: 'شماره موبایل' });
  await phoneBox.waitFor({ timeout: 30_000 });
  await phoneBox.fill(phone);
  const from = logSize();
  await page.getByRole('button', { name: 'دریافت کد ورود' }).click();
  const code = await smsAfter(from, OTP, 'sign-in code');
  await page.getByRole('textbox', { name: 'کد ورود' }).fill(code);
  await page.getByRole('button', { name: 'ورود', exact: true }).click();
  const nameBox = page.getByRole('textbox', { name: 'نام و نام خانوادگی' });
  await nameBox.waitFor({ timeout: 15_000 });
  await nameBox.fill(fullName);
  await page.getByRole('button', { name: 'ساخت حساب و ورود' }).click();
}

const browser = await launch();
const viewport = { width: 1440, height: 900 };
const owner = await (await browser.newContext({ viewport, locale: 'fa-IR' })).newPage();
const guestContext = await browser.newContext({ viewport, locale: 'fa-IR' });
const guest = await guestContext.newPage();
watchConsole(owner);
watchConsole(guest);
const railOf = (page) => page.getByRole('navigation', { name: 'ناوبری اصلی' });
const quickCreate = async (page, item) => {
  await railOf(page).getByRole('button', { name: 'ایجاد سریع' }).click();
  await page.getByRole('menuitem', { name: item }).click();
};

/* ------------------------------------------------ owner: sign-up and first workspace */

await owner.goto(`${base}/feed`);
check(await visible(owner.getByRole('heading', { name: 'ورود به تسکین' }), 30_000), 'signed out: the sign-in screen replaces the workspace');
check((await owner.locator('html').getAttribute('dir')) === 'rtl', 'the document is right-to-left');
await signIn(owner, ownerPhone, ownerName);
check(await visible(owner.getByRole('heading', { name: `${ownerName}، خوش آمدید` }), 15_000), 'a new account is asked for its first workspace');
await owner.getByRole('textbox', { name: 'نام فضای کاری' }).fill(workspaceName);
await owner.getByLabel('رمز مدیر').fill('Taskin-2026!');
await owner.getByRole('button', { name: 'ساخت فضای کاری' }).click();
check(await visible(railOf(owner), 20_000), 'the workspace loads after it is created');
check(await visible(owner.getByText(workspaceName).first()), `the new workspace «${workspaceName}» is the active one`);
const font = await owner.evaluate(() => getComputedStyle(document.body).fontFamily);
check(font.includes('IRANYekanX'), `IRANYekanX is the body font (${font})`);

/* ------------------------------------------------ owner: a project, then an invitation */

await quickCreate(owner, 'پروژه جدید');
let dialog = owner.getByRole('dialog', { name: 'پروژه جدید' });
await dialog.getByLabel('نام پروژه').fill(projectName);
check((await dialog.getByLabel('کلید پروژه').inputValue()) === 'P1', 'a Persian project name gets the key P1');
await dialog.getByRole('button', { name: 'ایجاد پروژه' }).click();
await owner.waitForURL('**/tasks');
const tree = owner.getByRole('navigation', { name: 'درخت پروژه‌ها' });
check(await visible(tree.getByRole('button', { name: new RegExp(projectName) })), 'the project appears in the project tree');

await quickCreate(owner, 'دعوت همکار');
dialog = owner.getByRole('dialog', { name: 'دعوت همکار' });
const addresses = dialog.getByLabel('ایمیل یا شماره موبایل همکاران');
await addresses.fill(guestPhone);
await addresses.press('Enter');
const beforeInvite = logSize();
await dialog.getByRole('button', { name: 'ارسال دعوت‌نامه' }).click();
const link = await smsAfter(beforeInvite, INVITE, 'invitation link');
check(link.includes('/invite?token='), 'the invitation SMS carries a join link');

/* ------------------------------------------------ guest: joins through the link */

const invite = new URL(link);
await guest.goto(`${base}${invite.pathname}${invite.search}`);
check(await visible(guest.getByRole('heading', { name: 'پیوستن به فضای کاری' }), 30_000), 'the invitation link asks the guest to sign in to join');
await signIn(guest, guestPhone, guestName);
await guest.waitForURL('**/feed', { timeout: 20_000 });
check(await visible(railOf(guest), 20_000), 'the guest lands on the desk');
check(await visible(guest.getByText(workspaceName).first()), 'the guest is in the inviting workspace');

/* ------------------------------------------------ tasks: created by one, seen live by the other */

await railOf(guest).getByRole('link', { name: 'پروژه‌ها و وظایف' }).click();
await guest.waitForURL('**/tasks');
check(await eventually(async () => (await guest.getByRole('navigation', { name: 'درخت پروژه‌ها' }).getByRole('button', { name: new RegExp(projectName) }).count()) === 1, 10_000), 'the guest sees the project');

await quickCreate(owner, 'وظیفه جدید');
dialog = owner.getByRole('dialog', { name: 'تعریف وظیفه جدید' });
await dialog.getByLabel('عنوان وظیفه').fill(taskTitle);
check(await eventually(async () => (await dialog.getByRole('checkbox', { name: guestName }).count()) === 1, 10_000), 'the owner can assign the new member');
await dialog.getByRole('checkbox', { name: guestName }).click();
await dialog.getByRole('button', { name: 'ایجاد وظیفه' }).click();
const ownerCard = owner.getByRole('group', { name: new RegExp(taskTitle) });
check(await visible(ownerCard), 'the task appears on the owner’s board');

const guestCard = guest.getByRole('group', { name: new RegExp(taskTitle) });
check(await visible(guestCard, 10_000), 'the task appears live on the guest’s board');

await owner.getByRole('checkbox', { name: `انجام شد: ${taskTitle}` }).click();
const guestDone = guest.getByRole('region', { name: 'ستون انجام شد' });
check(await eventually(async () => (await guestDone.getByRole('group', { name: new RegExp(taskTitle) }).count()) === 1, 10_000), 'completing it moves it to «انجام شد» live for the guest');
await owner.reload();
check(await eventually(async () => (await owner.getByRole('region', { name: 'ستون انجام شد' }).getByRole('group', { name: new RegExp(taskTitle) }).count()) === 1, 15_000), 'the completion is stored: still done after a reload');
await owner.screenshot({ path: `${out}/live_board.png` });

/* ------------------------------------------------ chat: live delivery, typing, receipts, reactions */

await quickCreate(owner, 'گفتگوی جدید');
dialog = owner.getByRole('dialog', { name: 'گفتگوی جدید' });
await dialog.getByRole('radio', { name: new RegExp(guestName) }).click();
await dialog.getByRole('button', { name: 'شروع گفتگو' }).click();
await owner.waitForURL('**/chats');
const ownerThread = owner.getByRole('region', { name: `گفتگوی ${guestName}` });
check(await visible(ownerThread, 10_000), 'the direct chat opens for the owner');
const hello = `سلام ${guestName}، بورد را ببین.`;
const ownerComposer = owner.getByRole('textbox', { name: `نوشتن پیام در ${guestName}` });
await ownerComposer.fill(hello);
await ownerComposer.press('Enter');
check(await visible(ownerThread.getByText(hello)), 'the owner’s message shows at once');

await railOf(guest).getByRole('link', { name: 'گفتگوها' }).click();
await guest.waitForURL('**/chats');
const guestEntry = guest.getByRole('button', { name: new RegExp(ownerName) }).first();
check(await visible(guestEntry, 10_000), 'the new chat appears live in the guest’s list');
await guestEntry.click();
const guestThread = guest.getByRole('region', { name: `گفتگوی ${ownerName}` });
check(await visible(guestThread.getByText(hello), 10_000), 'the guest receives the message');
check(await eventually(async () => (await ownerThread.getByRole('img', { name: 'خوانده شد' }).count()) >= 1, 10_000), 'the owner sees the read receipt');

const guestComposer = guest.getByRole('textbox', { name: `نوشتن پیام در ${ownerName}` });
await guestComposer.pressSequentially('دارم می‌نویسم', { delay: 30 });
check(await eventually(async () => ((await owner.getByTestId('typing-indicator').textContent()) ?? '').includes(`${guestName} در حال نوشتن است`), 10_000), 'the owner sees the guest typing');
await guestComposer.fill('دیدم، ممنون!');
await guestComposer.press('Enter');
check(await visible(ownerThread.getByText('دیدم، ممنون!'), 10_000), 'the owner receives the reply live');
check(await eventually(async () => ((await owner.getByTestId('typing-indicator').textContent()) ?? '') === '', 10_000), 'the typing line clears after the reply');

const bubbleOf = (thread, text) => thread.locator('div.group\\/message').filter({ hasText: text }).last();
const react = async (page, thread, text, label) => {
  const bubble = bubbleOf(thread, text);
  await bubble.hover();
  await bubble.getByRole('button', { name: 'اقدام‌های بیشتر' }).click();
  await page.getByRole('group', { name: 'واکنش سریع' }).getByRole('button', { name: label }).click();
};
await react(guest, guestThread, hello, 'واکنش قلب');
check(await eventually(async () => (await ownerThread.getByRole('button', { name: '❤️ — ۱ نفر' }).count()) === 1, 10_000), '❤️ from the guest shows live for the owner');
await react(guest, guestThread, hello, 'واکنش نپسندیدم');
check(await eventually(async () => (await ownerThread.getByRole('button', { name: '👎 — ۱ نفر' }).count()) === 1, 10_000), '👎 from the guest shows live for the owner');
await guestThread.getByRole('button', { name: '👎 — ۱ نفر' }).click();
check(await eventually(async () => (await ownerThread.getByRole('button', { name: /^👎/ }).count()) === 0, 10_000), 'toggling 👎 off removes it for the owner');
await guest.reload();
await guestEntry.click();
check(await eventually(async () => (await guest.getByRole('region', { name: `گفتگوی ${ownerName}` }).getByRole('button', { name: '❤️ — ۱ نفر' }).count()) === 1, 15_000), 'the ❤️ is stored: still there after a reload');
await owner.screenshot({ path: `${out}/live_chat.png` });

/* ------------------------------------------------ notifications: quick views and mark all read */

await railOf(guest).getByRole('button', { name: /^اعلان‌ها/ }).click();
const drawer = guest.getByRole('dialog', { name: 'اعلان‌ها' });
check(await visible(drawer), 'the guest opens the notification centre');
const cards = drawer.getByRole('listitem');
await drawer.getByRole('button', { name: /^وظایف ارجاع‌شده امروز/ }).click();
check(await eventually(async () => (await cards.filter({ hasText: taskTitle }).count()) === 1, 10_000), '«وظایف ارجاع‌شده امروز» lists the assignment');
await drawer.getByRole('button', { name: /^پیام‌های اشاره‌شده/ }).click();
check((await drawer.getByRole('button', { name: /^پیام‌های اشاره‌شده/ }).getAttribute('aria-pressed')) === 'true', '«پیام‌های اشاره‌شده» switches the view');
await drawer.getByRole('tab', { name: /خوانده‌نشده/ }).click();
check(await eventually(async () => (await cards.count()) >= 1), 'the unread tab lists the new notifications');
await drawer.getByRole('button', { name: 'علامت‌گذاری همه به‌عنوان خوانده‌شده' }).click();
check(await visible(drawer.getByText('همه اعلان‌ها را خوانده‌اید')), '«علامت‌گذاری همه به‌عنوان خوانده‌شده» empties the unread tab');
await guest.keyboard.press('Escape');
await guest.waitForTimeout(500);
await guest.reload();
await railOf(guest).waitFor({ timeout: 20_000 });
check(
  await eventually(async () => !(await railOf(guest).getByRole('button', { name: /^اعلان‌ها/ }).getAttribute('aria-label')).includes('خوانده‌نشده'), 10_000),
  'the read state is stored: no unread badge after a reload',
);

/* ------------------------------------------------ profile menu: sign out clears the session */

await railOf(guest).getByRole('button', { name: /حساب کاربری/ }).click();
await guest.getByRole('menuitem', { name: 'پروفایل من' }).click();
check(await visible(guest.getByRole('dialog', { name: 'پروفایل من' })), 'the profile menu opens «پروفایل من»');
await guest.keyboard.press('Escape');
await railOf(guest).getByRole('button', { name: /حساب کاربری/ }).click();
await guest.getByRole('menuitem', { name: 'خروج از حساب' }).click();
await guest.getByRole('dialog', { name: 'خروج از حساب کاربری' }).getByRole('button', { name: 'خروج از حساب' }).click();
check(await visible(guest.getByRole('heading', { name: 'ورود به تسکین' }), 15_000), 'signing out shows the sign-in screen');
const cookies = await guestContext.cookies();
check(!cookies.some((cookie) => /taskin_rt$/.test(cookie.name) && cookie.value), 'the refresh cookie is cleared');
await guest.reload();
check(await visible(guest.getByRole('heading', { name: 'ورود به تسکین' }), 30_000), 'the session stays gone after a reload');

await finish(browser);
