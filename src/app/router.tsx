import type { FC } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { LibraryScreen } from "./screens/library-screen";
import { LibraryAuthorScreen } from "./screens/library-author-screen";
import { ReaderScreen } from "./screens/reader/reader-screen";
import { SearchScreen } from "./screens/search-screen";
import { SettingsScreen } from "./screens/settings-screen";
import { ReaderErrorBoundary } from "./screens/reader/reader-error-boundary";
import { ROUTES } from "@/utils/routes";

export const Router: FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={ROUTES.LIBRARY} replace />} />
      <Route path={ROUTES.LIBRARY} element={<LibraryScreen />} />
      <Route path={ROUTES.LIBRARY_AUTHOR} element={<LibraryAuthorScreen />} />
      <Route
        path={ROUTES.READER}
        element={
          <ReaderErrorBoundary>
            <ReaderScreen />
          </ReaderErrorBoundary>
        }
      />
      <Route path={ROUTES.SEARCH} element={<SearchScreen />} />
      <Route path={ROUTES.SETTINGS} element={<SettingsScreen />} />
      <Route path="*" element={<Navigate to={ROUTES.LIBRARY} replace />} />
    </Routes>
  );
};
