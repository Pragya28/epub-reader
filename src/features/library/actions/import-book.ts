import { EpubServiceImpl } from "@/services/epub/epub.service";
import { OpfParser } from "@/services/epub/opf-parser";
import { createBookId } from "@/utils/create-book-id";
import {
  saveBookFile,
  saveBookMetadata,
} from "@/services/storage/book-repository";
import { hashFile } from "@/utils/hash-file";
import { db } from "@/services/storage/db";

export async function importBook(file: File) {
  const epubService = new EpubServiceImpl();
  const opfParser = new OpfParser();

  // 1. Extract OPF
  const extraction = await epubService.extractOpf(file);

  // 2. Parse OPF
  const parsedBook = opfParser.parse(extraction.opfXml);

  // 3. Create app-level ID
  const bookId = createBookId();

  const fileHash = await hashFile(file);

  const existing = await db.books.where("fileHash").equals(fileHash).first();
  if (existing) throw new Error("Book already imported");

  // 4. Persist metadata
  await saveBookMetadata({
    id: bookId,
    title: parsedBook.metadata.title,
    author: parsedBook.metadata.author,
    language: parsedBook.metadata.language,
    createdAt: Date.now(),
    fileHash,
  });

  // 5. Persist original EPUB
  await saveBookFile(bookId, file);

  return {
    id: bookId,
    metadata: parsedBook.metadata,
  };
}
