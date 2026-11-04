/**
 * The fiscal-year filter, bound to the router.
 *
 * Precedence is URL → storage → default (`fy.ts` owns that rule and tests it). The provider only wires it
 * to `useSearchParams`: it reads the current params, and writes back with `replace` so the FY chip does
 * not fill the back stack.
 */

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useSearchParams } from "react-router";

import {
  DEFAULT_FY_STATE,
  fyFromParams,
  fyToParams,
  loadFyState,
  resolveFy,
  saveFyState,
  type FyState,
  type FyWindow,
} from "./fy";

type FyContextValue = {
  state: FyState;
  window: FyWindow;
  setState: (next: FyState) => void;
};

const FyContext = createContext<FyContextValue | null>(null);

export function FyProvider({ children }: { children: ReactNode }): ReactNode {
  const [searchParams, setSearchParams] = useSearchParams();

  // Precedence lives in `fy.ts` (`initialFyState`) and is tested there; the provider only supplies the
  // three inputs. `DEFAULT_FY_STATE` is the last resort, never a hardcoded year.
  const state = useMemo<FyState>(
    () => fyFromParams(searchParams) ?? loadFyState() ?? DEFAULT_FY_STATE,
    [searchParams],
  );

  const setState = useCallback(
    (next: FyState) => {
      saveFyState(next);
      const params = new URLSearchParams(searchParams);
      // Remove the previous FY keys before writing the new ones, or `fy=custom` would leave a stale
      // `from`/`to` behind when switching back to a named FY.
      for (const key of ["fy", "from", "to"]) params.delete(key);
      for (const [key, value] of Object.entries(fyToParams(next))) params.set(key, value);
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const value = useMemo<FyContextValue>(
    () => ({ state, window: resolveFy(state), setState }),
    [state, setState],
  );

  return <FyContext.Provider value={value}>{children}</FyContext.Provider>;
}

export function useFy(): FyContextValue {
  const context = useContext(FyContext);
  if (context === null) throw new Error("useFy must be used inside <FyProvider>");
  return context;
}

/** Most consumers only need the resolved window. */
export function useFyWindow(): FyWindow {
  return useFy().window;
}
