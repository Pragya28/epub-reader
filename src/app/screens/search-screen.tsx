import { useEffect, useState, type FC } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search as SearchIcon, SearchX, X } from "lucide-react";
import { ROUTES } from "@/utils/routes";
import { useSearchScreen } from "@/features/library/hooks/use-search-screen";
import { SearchResultRow } from "@/features/library/components/search-result-row";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { SearchStatusFilter } from "@/features/library/utils/filter-search-results";
import {
  getBookCoverUrl,
  getBookWithFile,
} from "@/services/storage/book-repository";
import { EpubParser } from "@/services/epub/epub-parser";
import { extractSnippet } from "@/services/search/snippet";
import { flattenToc } from "@/features/reader/utils/flatten-toc";
import type { ChapterMatch } from "@/services/search/search-content";

const SEARCH_STATUS_OPTIONS: { value: SearchStatusFilter; label: string }[] = [
  { value: "unfinished", label: "Unfinished" },
  { value: "all", label: "All" },
  { value: "finished", label: "Finished" },
];

interface ContentMatchDisplay extends ChapterMatch {
  bookTitle: string;
  bookAuthor: string;
  coverUrl: string | undefined;
  chapterLabel: string;
  snippet: string;
}

async function loadContentMatchDisplay(
  match: ChapterMatch,
): Promise<ContentMatchDisplay | null> {
  const readerDoc = await getBookWithFile(match.bookId);
  if (!readerDoc) return null;

  const word = match.matchedWords[0];
  const parser = new EpubParser();
  const [parsedBook, coverUrl] = await Promise.all([
    parser.parseBook(readerDoc.file),
    getBookCoverUrl(match.bookId),
  ]);
  const chapter = await parsedBook.loadChapter(match.chapter);
  const tocEntry = flattenToc(parsedBook.toc, 0).find(
    ({ item }) => item.chapterIndex === match.chapter,
  );

  return {
    ...match,
    bookTitle: readerDoc.book.title,
    bookAuthor: readerDoc.book.author ?? "",
    coverUrl,
    chapterLabel: tocEntry?.item.label ?? "",
    snippet: extractSnippet(chapter.content, word),
  };
}

export const SearchScreen: FC = () => {
  const navigate = useNavigate();
  const {
    query,
    setQuery,
    metadataMatches,
    contentMatches,
    resultCount,
    isLoading,
    isSearching,
    statusFilter,
    setStatusFilter,
    hiddenCount,
  } = useSearchScreen();

  const [metadataCovers, setMetadataCovers] = useState<Record<string, string>>(
    {},
  );
  const [contentDisplay, setContentDisplay] = useState<ContentMatchDisplay[]>(
    [],
  );

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      metadataMatches.map(
        async (book) => [book.id, await getBookCoverUrl(book.id)] as const,
      ),
    ).then((pairs) => {
      if (cancelled) return;
      setMetadataCovers(
        Object.fromEntries(
          pairs.filter((pair): pair is [string, string] => !!pair[1]),
        ),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [metadataMatches]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all(contentMatches.map(loadContentMatchDisplay)).then(
      (results) => {
        if (cancelled) return;
        setContentDisplay(
          results.filter((r): r is ContentMatchDisplay => r !== null),
        );
      },
    );
    return () => {
      cancelled = true;
    };
  }, [contentMatches]);

  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center gap-2.5 border-b border-divider px-4 py-3.5">
        <button
          type="button"
          aria-label="Back"
          onClick={() => navigate(ROUTES.LIBRARY)}
          className="shrink-0 text-foreground"
        >
          <ArrowLeft className="size-5" strokeWidth={1.5} />
        </button>
        <div className="flex flex-1 items-center gap-2 rounded-lg bg-card px-3 py-2.5">
          <SearchIcon
            className="size-4 shrink-0 text-muted-foreground"
            strokeWidth={1.5}
          />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your library"
            aria-label="Search your library"
            className="font-reading min-w-0 flex-1 bg-transparent text-title-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
            >
              <X className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-4">
        {isSearching && (
          <ToggleGroup
            value={[statusFilter]}
            onValueChange={(next) => {
              const [picked] = next as SearchStatusFilter[];
              // Base UI clears the array when the active item is pressed
              // again; keep the current filter rather than falling into an
              // unlabelled fourth state.
              if (picked) setStatusFilter(picked);
            }}
            aria-label="Filter results by reading status"
            className="mb-4"
          >
            {SEARCH_STATUS_OPTIONS.map(({ value, label }) => (
              <ToggleGroupItem key={value} value={value} size="sm">
                {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}

        {/* Suppressed at zero results — the empty view below says it better
            than "0 results found" stacked on top of it. */}
        {isSearching && (isLoading || resultCount > 0) && (
          <p className="font-reading mb-5 text-meta text-muted-foreground italic">
            {isLoading
              ? "Searching…"
              : `${resultCount} ${resultCount === 1 ? "result" : "results"} found${hiddenCount > 0 ? ` · ${hiddenCount} hidden` : ""}`}
          </p>
        )}

        {isSearching && !isLoading && resultCount === 0 && (
          <Empty role="status" aria-live="polite" className="py-24">
            <EmptyHeader>
              <EmptyMedia>
                <SearchX
                  size={48}
                  strokeWidth={1.5}
                  className="text-muted-foreground/30"
                />
              </EmptyMedia>
              <EmptyTitle className="text-ui uppercase tracking-[0.15em] text-muted-foreground">
                No results found
              </EmptyTitle>
              <EmptyDescription className="text-ui-sm opacity-60">
                {hiddenCount > 0
                  ? `${hiddenCount} ${hiddenCount === 1 ? "result is" : "results are"} hidden by the current filter.`
                  : "Try a different word, or check the spelling."}
              </EmptyDescription>
            </EmptyHeader>
            {hiddenCount > 0 && (
              <EmptyContent>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStatusFilter("all")}
                >
                  Show all results
                </Button>
              </EmptyContent>
            )}
          </Empty>
        )}

        <div className="flex flex-col divide-y divide-divider">
          {metadataMatches.map((book) => (
            <SearchResultRow
              key={book.id}
              bookId={book.id}
              title={book.title}
              author={book.author ?? ""}
              coverUrl={metadataCovers[book.id]}
              onClick={() =>
                navigate(ROUTES.READER.replace(":bookId", book.id))
              }
            />
          ))}
          {contentDisplay.map((match) => (
            <SearchResultRow
              key={`${match.bookId}-${match.chapter}`}
              bookId={match.bookId}
              title={match.bookTitle}
              author={match.bookAuthor}
              coverUrl={match.coverUrl}
              chapterLabel={match.chapterLabel}
              snippet={match.snippet}
              highlightWord={match.matchedWords[0]}
              onClick={() =>
                navigate(ROUTES.READER.replace(":bookId", match.bookId), {
                  state: {
                    searchJump: {
                      chapterIndex: match.chapter,
                      word: match.matchedWords[0],
                    },
                  },
                })
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
};
