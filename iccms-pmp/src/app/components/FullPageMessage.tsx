import type { ReactNode } from "react";

/** Shared layout for the "loading", "no scope" and "forbidden" states. */
export function FullPageMessage({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      {children ? <div className="max-w-md text-sm text-slate-600">{children}</div> : null}
      {action}
    </main>
  );
}
