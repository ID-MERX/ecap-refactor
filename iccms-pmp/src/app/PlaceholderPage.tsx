import { siteConfig, programConfig, provinces, subPopulations } from "@/config";

/**
 * Phase 2 placeholder. Proves the toolchain end to end: Tailwind v4 compiles, the `@/` alias
 * resolves, `strict` typechecking passes, and every visible string comes from `@/config` rather than
 * being hardcoded. Phase 3 replaces this with the real shell and auth.
 */
export function PlaceholderPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-8 p-8">
      <header className="flex items-center gap-4">
        <img src={siteConfig.brand.logoMark} alt="" className="size-12" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{siteConfig.appName}</h1>
          <p className="text-sm text-slate-500">{siteConfig.appDescription}</p>
        </div>
      </header>

      <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        Phase 2 scaffold. The shell, authentication and modules arrive in Phase 3.
      </p>

      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="font-medium text-slate-500">Organisation</dt>
        <dd>{siteConfig.organization.name}</dd>

        <dt className="font-medium text-slate-500">Country</dt>
        <dd>{programConfig.country}</dd>

        <dt className="font-medium text-slate-500">Fiscal year</dt>
        <dd>
          {programConfig.fiscalYear.label(programConfig.fiscalYear.current())} (starts month{" "}
          {programConfig.fiscalYear.startMonth})
        </dd>

        <dt className="font-medium text-slate-500">Provinces</dt>
        <dd>{provinces.join(", ")}</dd>

        <dt className="font-medium text-slate-500">Sub-populations</dt>
        <dd className="flex flex-wrap gap-1">
          {subPopulations.map((sp) => (
            <span key={sp.key} className="rounded bg-slate-100 px-2 py-0.5 text-xs">
              {sp.label}
            </span>
          ))}
        </dd>

        <dt className="font-medium text-slate-500">Support</dt>
        <dd>{siteConfig.organization.supportEmail}</dd>
      </dl>
    </main>
  );
}
