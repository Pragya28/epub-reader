import { useEffect, type FC } from "react";
import { BrowserRouter } from "react-router-dom";
import { Router } from "./router";
import { ToastContainer } from "@/components/toast/toast-container";
import { ErrorBoundary } from "@/components/error-boundary/error-boundary";
import { clearCoverCache } from "@/services/storage/cover-cache";

const App: FC = () => {
  useEffect(() => {
    return () => {
      clearCoverCache();
    };
  }, []);

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
