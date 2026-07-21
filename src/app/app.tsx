import { useEffect, type FC } from "react";
import { BrowserRouter } from "react-router-dom";
import { Router } from "./router";
import { ToastContainer } from "@/components/toast/toast-container";
import { ErrorBoundary } from "@/components/error-boundary/error-boundary";
import { clearCoverCache } from "@/services/storage/cover-cache";
import { useRegisterSW } from "virtual:pwa-register/react";
import { toastStore } from "@/stores/toast-store";

const App: FC = () => {
  useEffect(() => {
    return () => {
      clearCoverCache();
    };
  }, []);

  const { needRefresh, updateServiceWorker } = useRegisterSW();

  useEffect(() => {
    if (needRefresh[0]) {
      toastStore.getState().show({
        message: "A new version is available.",
        actionLabel: "Reload",
        onAction: () => updateServiceWorker(true),
      });
    }
  }, [needRefresh, updateServiceWorker]);

  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Router />
      </ErrorBoundary>
      <ToastContainer />
    </BrowserRouter>
  );
};

export default App;
