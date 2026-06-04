import { libraryStore } from "@/features/library/store/library-store";

export function resetLibraryStore() {
  libraryStore.setState({
    books: [],
    isLoading: false,
    error: null,
  });
}
