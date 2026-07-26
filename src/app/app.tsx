import { useEffect, type FC } from "react";
import { BrowserRouter } from "react-router-dom";
import { Router } from "./router";
import { ErrorBoundary } from "@/components/error-boundary/error-boundary";
import { clearCoverCache } from "@/services/storage/cover-cache";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Toaster } from "@/components/toast/toaster";
import { notify } from "@/components/toast/toast";

const App: FC = () => {
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
    </BrowserRouter>
  );
};

export default App;
