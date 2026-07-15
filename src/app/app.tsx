import { useEffect, type FC } from "react";
import { BrowserRouter } from "react-router-dom";
import { Router } from "./router";
import { ToastContainer } from "@/components/toast/toast-container";
import { clearCoverCache } from "@/services/storage/cover-cache";

const App: FC = () => {
  useEffect(() => {
    return () => {
      clearCoverCache();
    };
  }, []);

  return (
    <BrowserRouter>
      <Router />
      <ToastContainer />
    </BrowserRouter>
  );
};

export default App;
