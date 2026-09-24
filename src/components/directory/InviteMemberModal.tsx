'use client';

import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import type { DepartmentId, Invitation, RoleId } from '@/types';
import type { InvitationDraft } from '@/store/workspace-reducer';
import { USERS } from '@/data/workspace';
import { DEPARTMENTS, ROLES, roleLabel } from '@/data/reference';
import { formatCount } from '@/lib/format';
import { useNamespacedId } from '@/hooks/useId';
import { Badge, Button, IconButton, Modal, RelativeTime, Select, Textarea } from '@/components/ui';
import { CloseIcon, SmsIcon, TrashIcon, UserAddIcon } from '@/components/icons';

export interface InviteMemberModalProps {
  readonly open: boolean;
  readonly invitations: readonly Invitation[];
  readonly onClose: () => void;
  readonly onSubmit: (draft: InvitationDraft) => void;
  readonly onRevoke: (invitationId: string) => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Latin and Persian separators both commit an address. */
const SEPARATORS = /[\s,،;؛]+/;
const INVITABLE_ROLES = ROLES.filter((role) => !role.locked);

/** A rejected address and why — rendered with the address bidi-isolated inside Persian copy. */
interface Problem {
  readonly email: string;
  readonly reason: string;
}

/**
 * Invites colleagues by email with a role and department. Addresses are entered as chips and
 * validated one by one, so a typo, an existing member or a pending invite is flagged on the
 * address itself instead of failing the whole batch.
 */
export function InviteMemberModal({ open, invitations, onClose, onSubmit, onRevoke }: InviteMemberModalProps) {
  const [recipients, setRecipients] = useState<readonly string[]>([]);
  const [pendingText, setPendingText] = useState('');
  const [problems, setProblems] = useState<readonly Problem[]>([]);
  const [role, setRole] = useState<RoleId>('member');
  const [department, setDepartment] = useState<DepartmentId>('engineering');
  const [message, setMessage] = useState('');
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const id = useNamespacedId('invite-');

  useEffect(() => {
    if (!open) return;
    setRecipients([]);
    setPendingText('');
    setProblems([]);
    setRole('member');
    setDepartment('engineering');
    setMessage('');
    setTouched(false);
  }, [open]);

  /** Validates raw tokens and adds the good ones. Returns the list as it will be after commit. */
  const commit = (raw: string): readonly string[] => {
    const tokens = raw
      .split(SEPARATORS)
      .map((token) => token.trim().toLowerCase())
      .filter(Boolean);
    if (tokens.length === 0) return recipients;

    const accepted: string[] = [];
    const rejected: Problem[] = [];
    for (const email of tokens) {
      if (recipients.includes(email) || accepted.includes(email)) continue;
      if (!EMAIL_PATTERN.test(email)) rejected.push({ email, reason: 'نشانی ایمیل معتبری نیست.' });
      else if (USERS.some((user) => user.email.toLowerCase() === email))
        rejected.push({ email, reason: 'از قبل عضو سازمان است.' });
      else if (invitations.some((invitation) => invitation.email === email))
        rejected.push({ email, reason: 'دعوت‌نامه در انتظار دارد.' });
      else accepted.push(email);
    }

    const next = [...recipients, ...accepted];
    setRecipients(next);
    setProblems(rejected);
    setPendingText('');
    return next;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (['Enter', ',', '،', ';', '؛', ' '].includes(event.key)) {
      if (!pendingText.trim()) {
        if (event.key === 'Enter') event.preventDefault();
        return;
      }
      event.preventDefault();
      commit(pendingText);
    } else if (event.key === 'Backspace' && pendingText === '' && recipients.length > 0) {
      setRecipients((current) => current.slice(0, -1));
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData('text');
    if (!SEPARATORS.test(text.trim())) return;
    event.preventDefault();
    commit(`${pendingText} ${text}`);
  };

  const submit = () => {
    setTouched(true);
    const finalList = pendingText.trim() ? commit(pendingText) : recipients;
    if (finalList.length === 0) return;
    onSubmit({ emails: finalList, role, department, message: message.trim() });
  };

  const emptyError = touched && recipients.length === 0 && problems.length === 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="دعوت همکار"
      description="همکاران را با ایمیل سازمانی دعوت کنید و نقش و دپارتمان آن‌ها را از همین ابتدا تعیین کنید."
      icon={<UserAddIcon size={20} />}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            انصراف
          </Button>
          <Button onClick={submit} iconStart={<SmsIcon size={18} />}>
            {recipients.length > 1 ? `ارسال ${formatCount(recipients.length)} دعوت‌نامه` : 'ارسال دعوت‌نامه'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-emails`} className="text-body-sm font-medium text-fg-secondary">
            ایمیل همکاران
          </label>
          <div
            className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-primary bg-surface px-2 py-1.5 shadow-xs transition-colors focus-within:border-brand focus-within:ring-2 focus-within:ring-brand"
            onClick={() => inputRef.current?.focus()}
          >
            {recipients.map((email) => (
              <span
                key={email}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-secondary bg-sunken pe-1 ps-2 text-caption font-medium text-fg-primary"
              >
                <span className="latin-inline">{email}</span>
                <IconButton
                  label={`حذف ${email}`}
                  icon={<CloseIcon size={12} />}
                  size="xs"
                  className="size-5"
                  onClick={(event) => {
                    event.stopPropagation();
                    setRecipients((current) => current.filter((entry) => entry !== email));
                  }}
                />
              </span>
            ))}
            <input
              ref={inputRef}
              id={`${id}-emails`}
              type="email"
              inputMode="email"
              dir="ltr"
              autoComplete="off"
              value={pendingText}
              onChange={(event) => setPendingText(event.target.value)}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
              onBlur={() => pendingText.trim() && commit(pendingText)}
              placeholder={recipients.length === 0 ? 'name@company.ir' : ''}
              aria-describedby={`${id}-hint`}
              aria-invalid={emptyError || problems.length > 0 || undefined}
              className="h-7 min-w-40 flex-1 bg-transparent px-1 text-body text-fg-primary outline-none placeholder:text-fg-placeholder focus-visible:ring-0 focus-visible:ring-offset-0"
              data-autofocus
            />
          </div>
          <p id={`${id}-hint`} className="text-caption text-fg-tertiary">
            چند نشانی را با ویرگول، فاصله یا Enter از هم جدا کنید.
          </p>
          {(problems.length > 0 || emptyError) && (
            <ul className="flex flex-col gap-0.5" role="alert">
              {emptyError && <li className="text-caption text-status-blocked">دست‌کم یک نشانی ایمیل وارد کنید.</li>}
              {problems.map((problem) => (
                <li key={problem.email} className="text-caption text-status-blocked">
                  <bdi className="font-medium">{problem.email}</bdi>
                  {` ${problem.reason}`}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="نقش"
            hideLabel={false}
            value={role}
            onValueChange={setRole}
            options={INVITABLE_ROLES.map((entry) => ({
              value: entry.id,
              label: entry.name,
              description: entry.description,
            }))}
          />
          <Select
            label="دپارتمان"
            hideLabel={false}
            value={department}
            onValueChange={setDepartment}
            options={DEPARTMENTS.map((entry) => ({ value: entry.id, label: entry.name }))}
          />
        </div>

        <Textarea
          label="پیام شخصی (اختیاری)"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="چند خط خوش‌آمدگویی که همراه دعوت‌نامه ارسال می‌شود…"
          maxLength={280}
          className="min-h-20"
        />

        {invitations.length > 0 && (
          <section aria-labelledby={`${id}-pending`} className="flex flex-col gap-2 border-t border-secondary pt-4">
            <div className="flex items-center gap-2">
              <h3 id={`${id}-pending`} className="text-body-sm font-semibold text-fg-primary">
                دعوت‌های در انتظار
              </h3>
              <Badge tone="neutral" size="sm" numeric>
                {formatCount(invitations.length)}
              </Badge>
            </div>
            <ul className="flex flex-col gap-1.5">
              {invitations.map((invitation) => (
                <PendingInvitationRow key={invitation.id} invitation={invitation} onRevoke={onRevoke} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </Modal>
  );
}

export function PendingInvitationRow({
  invitation,
  onRevoke,
}: {
  readonly invitation: Invitation;
  readonly onRevoke: (invitationId: string) => void;
}) {
  const departmentName = DEPARTMENTS.find((entry) => entry.id === invitation.department)?.name ?? '';
  return (
    <li className="flex items-center gap-2.5 rounded-lg border border-secondary bg-surface px-2.5 py-2">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sunken text-fg-tertiary">
        <SmsIcon size={16} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="latin-inline truncate text-caption font-semibold text-fg-primary">{invitation.email}</span>
        <span className="numeric truncate text-micro text-fg-tertiary">
          {`${roleLabel(invitation.role)}، ${departmentName}، `}
          <RelativeTime iso={invitation.invitedAt} />
        </span>
      </span>
      <IconButton
        label={`لغو دعوت ${invitation.email}`}
        icon={<TrashIcon size={16} />}
        size="sm"
        className="hover:text-status-blocked"
        onClick={() => onRevoke(invitation.id)}
      />
    </li>
  );
}
