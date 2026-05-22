import { useLibraryStore } from "@/features/library/store/library-store";

export function resetLibraryStore() {
  useLibraryStore.setState({
    books: [],
    isLoading: false,
    error: null,
  });
}
