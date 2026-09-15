import { useEffect, type FC } from "react";
import { BrowserRouter } from "react-router-dom";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Router } from "./router";
import { ErrorBoundary } from "@/components/error-boundary/error-boundary";
import { clearCoverCache } from "@/services/storage/cover-cache";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Toaster } from "@/components/toast/toaster";
import { notify } from "@/components/toast/toast";
import { useApplyTheme } from "@/features/preferences/hooks/use-apply-theme";

const App: FC = () => {
  useApplyTheme();

  useEffect(() => {
    // pagehide (genuine page teardown/navigation), not the effect's own
    // cleanup — React StrictMode's dev-mode double-invoke (mount → cleanup
    // → mount) would otherwise fire this immediately after the very first
    // mount, revoking cover blob URLs already handed to <img> elements on
    // the initial render.
    const handlePageHide = (event: PageTransitionEvent) => {
      // event.persisted means the page is only being frozen for the
      // back-forward cache, not actually torn down — the same <img>
      // elements (and their blob URLs) will still be on screen if the user
      // navigates back, so leave the cache intact rather than revoking URLs
      // there'd be no trigger to replace on a bfcache restore.
      if (!event.persisted) clearCoverCache();
    };
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, []);

  const { needRefresh, updateServiceWorker } = useRegisterSW();

  useEffect(() => {
    if (needRefresh[0]) {
      notify.info("A new version is available.", {
        label: "Reload",
        onClick: () => updateServiceWorker(true),
      });
    }
  }, [needRefresh, updateServiceWorker]);

  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Router />
      </ErrorBoundary>
      <Toaster />
      <SpeedInsights />
    </BrowserRouter>
  );
};

export default App;
