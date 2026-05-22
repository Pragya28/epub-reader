import type { FC } from "react";
import { Route, Routes } from "react-router-dom";
import { LibraryScreen } from "./screens/library-screen";
import { ReaderScreen } from "./screens/reader-screen";
import { SettingsScreen } from "./screens/settings-screen";
import { ROUTES } from "@/shared/utils/routes";

export const Router: FC = () => {
  return (
    <Routes>
      <Route path={ROUTES.LIBRARY} element={<LibraryScreen />} />
      <Route path={ROUTES.READER} element={<ReaderScreen />} />
      <Route path={ROUTES.SETTINGS} element={<SettingsScreen />} />
    </Routes>
  );
};
