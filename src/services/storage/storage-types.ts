export interface StoredBook {
  id: string;
  title: string;
  author?: string;
  language?: string | null;
  createdAt: number;
  fileHash: string;
}

export interface StoredBookFile {
  bookId: string;
  file: Blob;
}
