import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  checklistProgress,
  formatMobile,
  monogram,
  normaliseIranMobile,
  parseNoteBlocks,
  parseRecipient,
  serialiseNoteBlocks,
  splitForTask,
  splitRecipients,
  toLatinDigits,
} from '../dist/index.js';

test('Persian and Arabic-Indic digits become ASCII', () => {
  assert.equal(toLatinDigits('۰۹۱۲ ٣٤٥'), '0912 345');
});

test('Iranian mobile numbers normalise to 09xxxxxxxxx in every common form', () => {
  for (const raw of [
    '09121234567',
    '+989121234567',
    '00989121234567',
    '989121234567',
    '9121234567',
    '۰۹۱۲۱۲۳۴۵۶۷',
    '٠٩١٢١٢٣٤٥٦٧',
    '0912-123-4567',
    '(0912) 123 4567',
  ]) {
    assert.equal(normaliseIranMobile(raw), '09121234567', raw);
  }
  assert.equal(normaliseIranMobile('0812123456'), null);
  assert.equal(normaliseIranMobile('091212345'), null);
});

test('recipients are classified as SMS or email, with reasons for rejects', () => {
  assert.deepEqual(parseRecipient('+98 912 123 4567'), { ok: true, recipient: { address: '09121234567', channel: 'sms' } });
  assert.deepEqual(parseRecipient('A.B@Company.IR'), { ok: true, recipient: { address: 'a.b@company.ir', channel: 'email' } });
  assert.equal(parseRecipient('0812123456').ok, false);
  assert.equal(parseRecipient('bad@x').ok, false);
  assert.equal(parseRecipient('foo').ok, false);
});

test('whitespace inside grouped phone numbers does not split them', () => {
  assert.deepEqual(splitRecipients('a@b.com 0912 123 4567, +98 935 111 2233؛ c@d.ir\n۰۹۱۹۸۷۷۶۶۵۵ 0912 12'), [
    'a@b.com',
    '0912 123 4567',
    '+98 935 111 2233',
    'c@d.ir',
    '۰۹۱۹۸۷۷۶۶۵۵',
    '0912 12',
  ]);
  assert.equal(formatMobile('09121234567'), '۰۹۱۲ ۱۲۳ ۴۵۶۷');
});

test('monograms take two letters without splitting characters', () => {
  assert.equal(monogram('هلدینگ راهنما'), 'هر');
  assert.equal(monogram('Cloud Ops'), 'CO');
  assert.equal(monogram('taskin'), 'TA');
  assert.equal(monogram('   '), '؟');
});

test('note checklists round-trip through the block editor model', () => {
  const body = 'Kick-off\n- [x] Book the room\n- [ ] Send the agenda\n\nNotes after';
  assert.equal(serialiseNoteBlocks(parseNoteBlocks(body)), body);
  assert.deepEqual(checklistProgress(body), { done: 1, total: 2 });
  assert.deepEqual(splitForTask(body), {
    description: 'Kick-off\n- [x] Book the room\n\nNotes after',
    subtasks: ['Send the agenda'],
  });
});
