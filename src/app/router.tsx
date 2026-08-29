import { lazy, Suspense, type FC } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { LibraryScreen } from "./screens/library/library-screen";
import { LibraryAuthorScreen } from "./screens/library/library-author-screen";
import { LibrarySeriesScreen } from "./screens/library/library-series-screen";
import { LibraryCollectionScreen } from "./screens/library/library-collection-screen";
import { ReaderErrorBoundary } from "./screens/reader/reader-error-boundary";
import { ROUTES } from "@/utils/routes";
import { useViewportZoomLock } from "@/shared/hooks/use-viewport-zoom-lock";

// Split the reader (windowing engine + iframe renderer) and the search /
// settings screens (JSZip + EPUB parser via their indexing paths) out of the
// initial bundle — a user browsing their library doesn't need any of it yet.
// vite-plugin-pwa precaches every emitted chunk, so these still load offline.
const ReaderScreen = lazy(() =>
  import("./screens/reader/reader-screen").then((m) => ({
    default: m.ReaderScreen,
  })),
);
const SearchScreen = lazy(() =>
  import("./screens/search-screen").then((m) => ({ default: m.SearchScreen })),
);
const SettingsScreen = lazy(() =>
  import("./screens/settings/settings-screen").then((m) => ({
    default: m.SettingsScreen,
  })),
);

export const Router: FC = () => {
  useViewportZoomLock();

  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<Navigate to={ROUTES.LIBRARY} replace />} />
        <Route path={ROUTES.LIBRARY} element={<LibraryScreen />} />
        <Route path={ROUTES.LIBRARY_SHELVES} element={<LibraryScreen />} />
        <Route path={ROUTES.LIBRARY_AUTHOR} element={<LibraryAuthorScreen />} />
        <Route path={ROUTES.LIBRARY_SERIES} element={<LibrarySeriesScreen />} />
        <Route
          path={ROUTES.LIBRARY_COLLECTION}
          element={<LibraryCollectionScreen />}
        />
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
    </Suspense>
  );
};
