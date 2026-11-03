import { Component, Suspense } from "react";
import { lazyWithRetry, isChunkLoadError } from "@/lib/lazyWithRetry";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import EtlInvalidator from "@/components/EtlInvalidator";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { FyFilterProvider } from "@/context/FyFilterContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { ThemeProvider } from "@/context/ThemeContext";

// --- CORE PAGES (Eagerly Loaded) — only the entry + post-login home, the two
// pages almost always loaded first. Splitting these would add a flash, not help.
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import TrainingLog from "@/pages/TrainingLog.tsx";

// Previously these were all eager (~1.5MB initial bundle). Lazy-loading them
// shrinks the initial download; each becomes its own chunk fetched on first
// navigation (a few KB gzipped — effectively instant).
const HouseholdRegister = lazyWithRetry(
  () => import("./pages/HouseholdRegister"),
);
const VcaRegister = lazyWithRetry(() => import("./pages/VcaRegister"));
const HouseholdServices = lazyWithRetry(
  () => import("./pages/HouseholdServices"),
);
const HouseholdServicesPage = lazyWithRetry(
  () => import("./pages/HouseholdServicesPage"),
);
const VcaServices = lazyWithRetry(() => import("./pages/VcaServices"));
const CaregiverServices = lazyWithRetry(
  () => import("./pages/CaregiverServices"),
);
const HTSRegister = lazyWithRetry(() => import("./pages/HTSRegister"));
const PMTCTRegister = lazyWithRetry(() => import("./pages/PMTCTRegister"));
const Referrals = lazyWithRetry(() => import("./pages/Referrals"));
const MotherIndexRegister = lazyWithRetry(
  () => import("./pages/MotherIndexRegister"),
);
const Users = lazyWithRetry(() => import("./pages/Users"));
const Profile = lazyWithRetry(() => import("./pages/Profile"));
const HouseholdProfile = lazyWithRetry(
  () => import("./pages/HouseholdProfile"),
);
const VcaProfile = lazyWithRetry(() => import("./pages/VcaProfile"));
const HTSProfile = lazyWithRetry(() => import("./pages/HTSProfile"));
const PMTCTProfile = lazyWithRetry(() => import("./pages/PMTCTProfile"));
const MotherIndexDetails = lazyWithRetry(
  () => import("./pages/MotherIndexDetails"),
);
const VcaServiceProfile = lazyWithRetry(
  () => import("./pages/VcaServiceProfile"),
);
const HouseholdServiceProfile = lazyWithRetry(
  () => import("./pages/HouseholdServiceProfile"),
);
const CaregiverServiceProfile = lazyWithRetry(
  () => import("./pages/CaregiverServiceProfile"),
);
const CaregiverRiskRegister = lazyWithRetry(
  () => import("./pages/CaregiverRiskRegister"),
);
const VcaRiskRegister = lazyWithRetry(() => import("./pages/VcaRiskRegister"));
const HouseholdRiskRegister = lazyWithRetry(
  () => import("./pages/HouseholdRiskRegister"),
);
const HTSRiskRegister = lazyWithRetry(() => import("./pages/HTSRiskRegister"));
const CaseworkerProfile = lazyWithRetry(
  () => import("./pages/CaseworkerProfile"),
);
const Performance = lazyWithRetry(() => import("./pages/Performance"));

// --- SECONDARY / HEAVY PAGES (Lazy Loaded to keep initial bundle size optimized) ---
const Districts = lazyWithRetry(() => import("./pages/Districts"));
const Flags = lazyWithRetry(() => import("./pages/Flags"));
const HouseholdArchivedRegister = lazyWithRetry(
  () => import("./pages/HouseholdArchivedRegister"),
);
const VcaArchivedRegister = lazyWithRetry(
  () => import("./pages/VcaArchivedRegister"),
);
const Charts = lazyWithRetry(() => import("./pages/Charts"));
const AddUser = lazyWithRetry(() => import("./pages/AddUser"));
const EditUser = lazyWithRetry(() => import("./pages/EditUser"));
const ForgotPassword = lazyWithRetry(() => import("./pages/ForgotPassword"));
const ResetPassword = lazyWithRetry(() => import("./pages/ResetPassword"));
const AcceptInvite = lazyWithRetry(() => import("./pages/AcceptInvite"));
const ChangePassword = lazyWithRetry(() => import("./pages/ChangePassword"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const FlaggedRecordForm = lazyWithRetry(
  () => import("./pages/FlaggedRecordForm"),
);
const DataPipelinePage = lazyWithRetry(
  () => import("./pages/DataPipelinePage"),
);
const SupportCenter = lazyWithRetry(() => import("./pages/SupportCenter"));
const Calendar = lazyWithRetry(() => import("./pages/Calendar"));
const Documentation = lazyWithRetry(() => import("./pages/Documentation"));
const DocumentationArticle = lazyWithRetry(
  () => import("./pages/DocumentationArticle"),
);
const CaseworkerJourneys = lazyWithRetry(
  () => import("./pages/CaseworkerJourneys"),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale-while-revalidate pattern:
      //  - 60s staleTime: cached data renders instantly; after a minute,
      //    next mount/focus triggers a *silent background refetch*. The user
      //    keeps seeing the cached number until the new one arrives, then
      //    it swaps in without a loading spinner.
      //  - 24h gcTime: unused data stays in memory all day so navigation
      //    back to a previous tab is instant.
      //  - 24h IndexedDB persistence (below): even after a full reload or
      //    next-day visit, cached data renders immediately.
      //  - refetchOnMount/Focus/Reconnect all true: every opportunity to
      //    catch new server data triggers a background refresh.
      staleTime: 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});

// IndexedDB-backed persister via idb-keyval. The TanStack cache survives
// page reloads and tab close/reopen for 24h, giving us stale-while-revalidate
// behaviour: previously fetched data renders instantly, then a fresh fetch
// runs in the background.
const persister = createAsyncStoragePersister({
  storage: {
    getItem: (key) => idbGet(key).then((v) => (v === undefined ? null : v)),
    setItem: (key, value) => idbSet(key, value),
    removeItem: (key) => idbDel(key),
  },
  key: "ecap-plus-pmp-react-query",
  throttleTime: 1000,
});

// Bump this when the cache shape changes so old persisted entries are tossed,
// or to force every user to drop their persisted cache on next load.
const PERSIST_BUSTER = "v13-2026-06-16-caseworker-list";

// Auxiliary IDB cache (used by getListFromApiWithCache) is separate from React
// Query's persister. Clear it once when buster changes so the two caches stay
// in lock-step — otherwise stale empty-list responses survive a buster bump.
if (typeof window !== "undefined") {
  const lastSeen = window.localStorage.getItem("ecap_plus_persist_buster");
  if (lastSeen !== PERSIST_BUSTER) {
    void import("@/lib/indexedDbCache").then((m) => m.clearAllCacheEntries());
    window.localStorage.setItem("ecap_plus_persist_buster", PERSIST_BUSTER);
  }
}

const PageLoader = () => null;

// Last-resort backstop. `lazyWithRetry` already performs one guarded hard
// reload on a stale-chunk error; if the chunk is STILL missing after that
// reload, the error reaches here and we show an explicit message instead of a
// blank screen. We do NOT auto-reload here — that would defeat the guard and
// loop forever.
class ChunkErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError(error: unknown) {
    if (isChunkLoadError(error)) {
      return { hasError: true };
    }
    // Not a chunk error — leave state untouched so it isn't masked here.
    return null;
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
          <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <h1 className="text-lg font-bold text-slate-900">
              Reload required
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              A new version of the app is available. Please reload to continue.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Reload now
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const App = () => (
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={{
      persister,
      maxAge: 24 * 60 * 60 * 1000,
      buster: PERSIST_BUSTER,
      dehydrateOptions: {
        shouldDehydrateQuery: (query) =>
          query.state.status === "success" && query.state.data !== undefined,
      },
    }}
  >
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <EtlInvalidator />
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <FyFilterProvider>
              <ChunkErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route
                      path="/forgot-password"
                      element={<ForgotPassword />}
                    />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/accept-invite" element={<AcceptInvite />} />
                    <Route
                      path="/change-password"
                      element={
                        <ProtectedRoute>
                          <ChangePassword />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/dashboard"
                      element={
                        <ProtectedRoute>
                          <Dashboard />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/districts"
                      element={
                        <ProtectedRoute>
                          <Districts />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/households"
                      element={
                        <ProtectedRoute>
                          <HouseholdRegister />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/vcas"
                      element={
                        <ProtectedRoute>
                          <VcaRegister />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/registers/hts"
                      element={
                        <ProtectedRoute>
                          <HTSRegister />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/registers/hts-risk"
                      element={
                        <ProtectedRoute>
                          <HTSRiskRegister />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/registers/pmtct"
                      element={
                        <ProtectedRoute>
                          <PMTCTRegister />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/registers/mother-index"
                      element={
                        <ProtectedRoute>
                          <MotherIndexRegister />
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/vca-services"
                      element={
                        <ProtectedRoute>
                          <VcaServices />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/registers/vca-risk"
                      element={
                        <ProtectedRoute>
                          <VcaRiskRegister />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/household-services"
                      element={
                        <ProtectedRoute>
                          <HouseholdServices />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/registers/household-risk"
                      element={
                        <ProtectedRoute>
                          <HouseholdRiskRegister />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/caregiver-services"
                      element={
                        <ProtectedRoute>
                          <CaregiverServices />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/registers/caregiver-risk"
                      element={
                        <ProtectedRoute>
                          <CaregiverRiskRegister />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/profile/caseworker-details"
                      element={
                        <ProtectedRoute>
                          <CaseworkerProfile />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/services/household-services"
                      element={
                        <ProtectedRoute>
                          <HouseholdServicesPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/flags"
                      element={
                        <ProtectedRoute>
                          <Flags />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/households/archived"
                      element={
                        <ProtectedRoute>
                          <HouseholdArchivedRegister />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/vcas/archived"
                      element={
                        <ProtectedRoute>
                          <VcaArchivedRegister />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/charts"
                      element={
                        <ProtectedRoute>
                          <Charts />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/users"
                      element={
                        <ProtectedRoute>
                          <Users />
                        </ProtectedRoute>
                      }
                    />
                      <Route
                          path="/training-log"
                          element={
                              <ProtectedRoute>
                                  <TrainingLog />
                              </ProtectedRoute>
                          }
                      />
                    <Route
                      path="/users/new"
                      element={
                        <ProtectedRoute>
                          <AddUser />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/users/:id/edit"
                      element={
                        <ProtectedRoute>
                          <EditUser />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/profile"
                      element={
                        <ProtectedRoute>
                          <Profile />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/profile/household-details"
                      element={
                        <ProtectedRoute>
                          <HouseholdProfile />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/profile/vca-details"
                      element={
                        <ProtectedRoute>
                          <VcaProfile />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/profile/hts-details"
                      element={
                        <ProtectedRoute>
                          <HTSProfile />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/profile/pmtct-details"
                      element={
                        <ProtectedRoute>
                          <PMTCTProfile />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/profile/mother-index-details"
                      element={
                        <ProtectedRoute>
                          <MotherIndexDetails />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/profile/vca-service-details"
                      element={
                        <ProtectedRoute>
                          <VcaServiceProfile />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/profile/household-service-details"
                      element={
                        <ProtectedRoute>
                          <HouseholdServiceProfile />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/profile/caregiver-service-details"
                      element={
                        <ProtectedRoute>
                          <CaregiverServiceProfile />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/flagged-record-form"
                      element={
                        <ProtectedRoute>
                          <FlaggedRecordForm />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/data-pipeline"
                      element={
                        <ProtectedRoute>
                          <DataPipelinePage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/support"
                      element={
                        <ProtectedRoute>
                          <SupportCenter />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/calendar"
                      element={
                        <ProtectedRoute>
                          <Calendar />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/documentation"
                      element={
                        <ProtectedRoute>
                          <Documentation />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/documentation/:slug"
                      element={
                        <ProtectedRoute>
                          <DocumentationArticle />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/caseworker-journeys"
                      element={
                        <ProtectedRoute>
                          <CaseworkerJourneys />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/performance"
                      element={
                        <ProtectedRoute>
                          <Performance />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/referrals"
                      element={
                        <ProtectedRoute>
                          <Referrals />
                        </ProtectedRoute>
                      }
                    />
                    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </ChunkErrorBoundary>
            </FyFilterProvider>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </PersistQueryClientProvider>
);

export default App;
