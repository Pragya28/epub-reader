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
    return () => {
      clearCoverCache();
    };
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
