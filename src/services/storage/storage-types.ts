export interface StoredBook {
  id: string;
  title: string;
  author?: string;
  language?: string | null;
  createdAt: number;
  fileHash: string;
  coverBg?: string;
}

export interface StoredBookFile {
  bookId: string;
  file: Blob;
}

export interface StoredBookCover {
  bookId: string;
  cover: Blob;
}
