import { useEffect, useRef, useState, useCallback } from "react";
import { embedDashboard } from "@superset-ui/embedded-sdk";
import { fetchGuestToken, SUPERSET_DOMAIN } from "@/lib/superset";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, RefreshCw, Maximize2, Minimize2 } from "lucide-react";

interface EmbeddedDashboardProps {
  dashboardId: string;
  /** Optional title shown while loading */
  title?: string;
  /** Minimum height of the container (default "80vh") */
  minHeight?: string;
}

type Status = "loading" | "ready" | "error";

const EmbeddedDashboard = ({
  dashboardId,
  title = "Dashboard",
  minHeight = "80vh",
}: EmbeddedDashboardProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { user } = useAuth();

  const embed = useCallback(async () => {
    if (!containerRef.current || !dashboardId) return;

    setStatus("loading");
    setErrorMessage("");

    try {
      await embedDashboard({
        id: dashboardId,
        supersetDomain: SUPERSET_DOMAIN,
        mountPoint: containerRef.current,
        fetchGuestToken: () =>
          fetchGuestToken(dashboardId, {
            username: user?.email ?? "guest",
            first_name: user?.first_name ?? "Guest",
            last_name: user?.last_name ?? "User",
          }),
        dashboardUiConfig: {
          hideTitle: true,
          hideChartControls: false,
          hideTab: false,
          filters: { expanded: false },
          urlParams: {},
        },
      });

      setStatus("ready");
    } catch (err) {
      console.error("Failed to embed Superset dashboard:", err);
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to load dashboard",
      );
      setStatus("error");
    }
  }, [dashboardId, user]);

  useEffect(() => {
    embed();
  }, [embed]);

  // Style the SDK's iframe to fill the container
  useEffect(() => {
    if (status !== "ready" || !containerRef.current) return;

    const iframe = containerRef.current.querySelector("iframe");
    if (iframe) {
      iframe.style.width = "100%";
      iframe.style.height = "100%";
      iframe.style.minHeight = minHeight;
      iframe.style.border = "none";
    }
  }, [status, minHeight]);

  const toggleFullscreen = () => setIsFullscreen((prev) => !prev);

  const wrapperClass = isFullscreen
    ? "fixed inset-0 z-50 bg-white dark:bg-slate-950"
    : "relative rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden shadow-sm";

  return (
    <div className={wrapperClass} style={{ minHeight: isFullscreen ? "100vh" : minHeight }}>
      {/* Toolbar */}
      <div className="absolute top-2 right-2 z-20 flex gap-2">
        {status === "ready" && (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 bg-white/80 dark:bg-slate-900/80 backdrop-blur"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      {/* Loading overlay */}
      {status === "loading" && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-sm">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
          <p className="text-sm text-slate-500">Loading {title}…</p>
        </div>
      )}

      {/* Error overlay */}
      {status === "error" && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-50/90 dark:bg-slate-950/90 p-6 text-center backdrop-blur-sm">
          <div className="max-w-md space-y-4">
            <AlertTriangle className="mx-auto h-12 w-12 text-amber-500 opacity-60" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Unable to Load Dashboard
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {errorMessage}
            </p>
            <Button onClick={embed} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" /> Retry
            </Button>
          </div>
        </div>
      )}

      {/* SDK mount point */}
      <div
        ref={containerRef}
        style={{ width: "100%", height: "100%", minHeight }}
      />
    </div>
  );
};

export default EmbeddedDashboard;
