export interface StoredBook {
  id: string;
  title: string;
  author?: string;
  language?: string | null;
  createdAt: number;
}

export interface StoredBookFile {
  bookId: string;
  file: Blob;
}
