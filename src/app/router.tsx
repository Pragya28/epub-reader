import type { FC } from "react";
import { Route, Routes } from "react-router-dom";
import { ROUTES } from "../utils/routes";
import { LibraryScreen } from "./screens/library-screen";
import { ReaderScreen } from "./screens/reader-screen";
import { SettingsScreen } from "./screens/settings-screen";

export const Router: FC = () => {
  return (
    <Routes>
      <Route path={ROUTES.LIBRARY} element={<LibraryScreen />} />
      <Route path={ROUTES.READER} element={<ReaderScreen />} />
      <Route path={ROUTES.SETTINGS} element={<SettingsScreen />} />
    </Routes>
  );
};
