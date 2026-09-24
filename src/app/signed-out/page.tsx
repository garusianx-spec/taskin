'use client';

import { useRouter } from 'next/navigation';
import { WORKSPACE } from '@/data/workspace';
import { useWorkspace } from '@/store/WorkspaceProvider';
import { Button } from '@/components/ui';
import { CheckCircleIcon, LogoutIcon } from '@/components/icons';

/**
 * Landing screen after "خروج از حساب". The shell redirects here whenever the session is
 * signed out, so no workspace route renders stale data behind a signed-out session.
 */
export default function SignedOutPage() {
  const router = useRouter();
  const { state, dispatch } = useWorkspace();
  const signedOut = state.session === 'signed-out';

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas p-4">
      <section
        aria-labelledby="signed-out-title"
        className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-secondary bg-surface p-6 text-center shadow-lg"
      >
        <span className="flex size-14 items-center justify-center rounded-2xl bg-brand-solid text-title font-bold text-fg-on-brand shadow-xs">
          {WORKSPACE.initials}
        </span>
        <div className="flex flex-col gap-1.5">
          <h1 id="signed-out-title" className="text-heading-sm font-bold text-fg-primary">
            {signedOut ? 'از حساب خود خارج شدید' : 'شما وارد حساب هستید'}
          </h1>
          <p className="text-body-sm text-fg-tertiary">
            {signedOut
              ? `نشست شما در ${WORKSPACE.name} پایان یافت و اطلاعات آن از این مرورگر پاک شد.`
              : `نشست شما در ${WORKSPACE.name} هنوز فعال است.`}
          </p>
        </div>
        <span
          className="inline-flex items-center gap-1.5 rounded-full bg-status-done-subtle px-3 py-1 text-caption font-medium text-status-done"
          role="status"
        >
          {signedOut ? <LogoutIcon size={14} /> : <CheckCircleIcon size={14} />}
          {signedOut ? 'خروج امن انجام شد' : 'نشست فعال'}
        </span>
        <Button
          fullWidth
          size="lg"
          onClick={() => {
            if (signedOut) dispatch({ type: 'sign-in' });
            router.push('/feed');
          }}
        >
          {signedOut ? 'ورود دوباره' : 'بازگشت به میز کار'}
        </Button>
      </section>
    </main>
  );
}
