import type { ReactNode } from "react";
import { NuqsAdapter } from "nuqs/adapters/react-router/v8";

import { FyProvider } from "@/platform/scope/FyProvider";

/**
 * URL-state providers.
 *
 * **Order matters and is easy to get wrong:** `NuqsAdapter` reads the *router's* location, so it must be
 * inside the router element tree — not wrapped around `RouterProvider`. `FyProvider` also uses
 * `useSearchParams`, so it goes inside too, and above the shell so the FY filter is global.
 *
 * Both are mounted as a layout route in `router.tsx`.
 */
export function UrlStateBoundary({ children }: { children: ReactNode }) {
  return (
    <NuqsAdapter>
      <FyProvider>{children}</FyProvider>
    </NuqsAdapter>
  );
}
