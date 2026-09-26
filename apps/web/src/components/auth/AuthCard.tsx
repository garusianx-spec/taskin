import type { ReactNode } from 'react';

/** The centred card every signed-out screen sits in (sign-in, first workspace, loading). */
export function AuthCard({ title, description, children, labelledBy }: { readonly title: string; readonly description?: string; readonly children?: ReactNode; readonly labelledBy: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas p-4">
      <section aria-labelledby={labelledBy} className="flex w-full max-w-sm flex-col gap-5 rounded-2xl border border-secondary bg-surface p-6 shadow-lg">
        <header className="flex flex-col items-center gap-3 text-center">
          <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-xl bg-brand-solid text-heading-sm font-extrabold text-fg-on-brand shadow-xs">
            ت
          </span>
          <div className="flex flex-col gap-1.5">
            <h1 id={labelledBy} className="text-heading-sm font-bold text-fg-primary">
              {title}
            </h1>
            {description && <p className="text-body-sm text-fg-tertiary">{description}</p>}
          </div>
        </header>
        {children}
      </section>
    </main>
  );
}
