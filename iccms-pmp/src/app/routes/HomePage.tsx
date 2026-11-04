import { programConfig, siteConfig } from "@/config";
import { useAuth } from "@/core/auth";

/**
 * Placeholder dashboard for Phase 3. The real dashboard is a module and arrives in Phase 5; this page
 * exists so the shell can be proven end to end: sign in, see your scope, sign out, cache empty.
 */
export function HomePage() {
  const { state } = useAuth();
  if (state.status !== "authenticated") return null;

  const { scope } = state.access;
  const fy = programConfig.fiscalYear;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{siteConfig.appName}</h1>
        <p className="text-sm text-slate-500">
          {fy.label(fy.current())} · {programConfig.country}
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">Your access</h2>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
          <dt className="text-slate-500">Level</dt>
          <dd>{scope.level}</dd>
          {scope.level === "province" ? (
            <>
              <dt className="text-slate-500">Province</dt>
              <dd>{scope.province}</dd>
              <dt className="text-slate-500">Districts</dt>
              <dd>{scope.districts.join(", ")}</dd>
            </>
          ) : null}
          {scope.level === "district" ? (
            <>
              <dt className="text-slate-500">District</dt>
              <dd>{scope.district}</dd>
            </>
          ) : null}
          <dt className="text-slate-500">Permissions</dt>
          <dd>{[...state.access.permissions].sort().join(", ")}</dd>
        </dl>
      </section>

      <p className="text-sm text-slate-500">
        Phase 3 shell. Registers and dashboards are built in Phase 5, module by module.
      </p>
    </div>
  );
}
