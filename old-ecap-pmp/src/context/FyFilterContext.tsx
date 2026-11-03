import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  type FyState,
  type FyResolved,
  fyFromParams,
  fyToParams,
  getCurrentFy,
  resolveFy,
} from "@/lib/fiscalYear";

const STORAGE_KEY = "ecap_plus_pmp.fy_filter_state_v2";

interface FyContextValue {
  state: FyState;
  setState: (s: FyState) => void;
  /** Reset to the default ("All time") and wipe the URL params + localStorage. */
  clearFilter: () => void;
  resolved: FyResolved;
}

// Default to "All time" so first-paint numbers match Superset lifetime totals.
// Users explicitly select a fiscal year from the chip when they want to scope.
const defaultState: FyState = { mode: "all" };

const FyContext = createContext<FyContextValue>({
  state: defaultState,
  setState: () => {},
  clearFilter: () => {},
  resolved: resolveFy(defaultState),
});

const loadStored = (): FyState => {
  if (typeof window === "undefined") return defaultState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw) as FyState;
    if (!parsed?.mode) return defaultState;
    return parsed;
  } catch {
    return defaultState;
  }
};

export const FyFilterProvider = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();

  // URL > localStorage > default
  const initialState = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const fromUrl = fyFromParams(params);
    if (fromUrl) return fromUrl;
    return loadStored();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [state, setStateInternal] = useState<FyState>(initialState);

  const setState = useCallback(
    (next: FyState) => {
      setStateInternal(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      // Reflect into URL so links are shareable.
      const params = new URLSearchParams(location.search);
      // Remove old fy params before applying new ones.
      params.delete("fy");
      params.delete("from");
      params.delete("to");
      const fresh = fyToParams(next);
      Object.entries(fresh).forEach(([k, v]) => {
        if (v) params.set(k, v);
      });
      const qs = params.toString();
      navigate({ pathname: location.pathname, search: qs ? `?${qs}` : "" }, { replace: true });
    },
    [location.pathname, location.search, navigate],
  );

  // True "clear" — drops the FY state, wipes localStorage, and strips the URL
  // params entirely. Distinct from setState({mode:"all"}) which leaves an
  // explicit ?fy=all marker in the URL.
  const clearFilter = useCallback(() => {
    setStateInternal(defaultState);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    const params = new URLSearchParams(location.search);
    params.delete("fy");
    params.delete("from");
    params.delete("to");
    const qs = params.toString();
    navigate({ pathname: location.pathname, search: qs ? `?${qs}` : "" }, { replace: true });
  }, [location.pathname, location.search, navigate]);

  // If the URL changes externally (e.g. user pastes a link), sync state.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const fromUrl = fyFromParams(params);
    if (!fromUrl) return;
    setStateInternal((prev) => {
      // Cheap deep-ish compare: avoid re-renders if unchanged.
      if (JSON.stringify(prev) === JSON.stringify(fromUrl)) return prev;
      return fromUrl;
    });
  }, [location.search]);

  const value = useMemo<FyContextValue>(
    () => ({ state, setState, clearFilter, resolved: resolveFy(state) }),
    [state, setState, clearFilter],
  );

  return <FyContext.Provider value={value}>{children}</FyContext.Provider>;
};

export const useFyFilter = () => useContext(FyContext);
