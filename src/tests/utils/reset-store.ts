import { libraryStore } from "@/features/library/store/library-store";
import { pwaStore } from "@/features/pwa/store/pwa-store";

export function resetLibraryStore() {
  libraryStore.setState({
    books: [],
    isLoading: false,
    error: null,
    evicted: false,
  });
}

export function resetPwaStore() {
  pwaStore.setState({
    firstImportDone: false,
    persistRequested: false,
    installDismissed: false,
    hadBooks: false,
  });
}
