import type { Attachment } from '@taskin/contracts';
import { formatFileSize } from './format';
import { formatJalali } from '@taskin/jalali';

/**
 * Saves an attachment to the user's device.
 *
 * Uploaded files carry a `url` and download directly. Fixtures ship no binaries (see README,
 * "What is mocked"), so for those the browser receives a small, clearly named text receipt
 * describing the file rather than a fake `.zip` or `.pdf` that would fail to open.
 */
export function downloadAttachment(attachment: Attachment): void {
  const anchor = document.createElement('a');
  let revoke: (() => void) | null = null;

  if (attachment.url) {
    anchor.href = attachment.url;
    anchor.download = attachment.name;
  } else {
    const receipt = [
      `نام فایل: ${attachment.name}`,
      `حجم: ${formatFileSize(attachment.size)}`,
      `بارگذاری: ${formatJalali(attachment.uploadedAt, 'full')}`,
      '',
      'این نسخه نمایشی تسکین است و محتوای واقعی فایل روی سرور ذخیره نشده است.',
    ].join('\n');
    const blobUrl = URL.createObjectURL(new Blob([receipt], { type: 'text/plain;charset=utf-8' }));
    anchor.href = blobUrl;
    anchor.download = `${attachment.name}.txt`;
    revoke = () => URL.revokeObjectURL(blobUrl);
  }

  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  if (revoke) window.setTimeout(revoke, 0);
}
