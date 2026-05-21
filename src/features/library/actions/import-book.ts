import { EpubServiceImpl } from "@/services/epub/epub.service";
import { OpfParser } from "@/services/epub/opf-parser";
import { createBookId } from "@/utils/create-book-id";
import {
  saveBookFile,
  saveBookMetadata,
} from "@/services/storage/book-repository";

export async function importBook(file: File) {
  const epubService = new EpubServiceImpl();
  const opfParser = new OpfParser();

  // 1. Extract OPF
  const extraction = await epubService.extractOpf(file);

  // 2. Parse OPF
  const parsedBook = opfParser.parse(extraction.opfXml);

  // 3. Create app-level ID
  const bookId = createBookId();

  // 4. Persist metadata
  await saveBookMetadata({
    id: bookId,
    title: parsedBook.metadata.title,
    author: parsedBook.metadata.author,
    language: parsedBook.metadata.language,
    createdAt: Date.now(),
  });

  // 5. Persist original EPUB
  await saveBookFile(bookId, file);

  return {
    id: bookId,
    metadata: parsedBook.metadata,
  };
}
