import { useEffect, useRef, useState, useCallback, type FC } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { loadReaderBook } from "@/features/reader/actions/load-reader-book";
import { jumpToTocItem } from "@/features/reader/actions/jump-to-toc-item";
import { ReaderFrame } from "@/features/reader/components/reader-frame";
import { useReaderEngine } from "@/features/reader/hooks/use-reader-engine";
import { readerStore } from "@/features/reader/store/reader-store";
import type { TocItem } from "@/services/epub/epub-types";
import { TocDrawer } from "@/features/reader/components/toc-drawer";
import { ReaderToolbar } from "@/features/reader/components/reader-toolbar";
import { ExternalLinkDialog } from "@/features/reader/components/external-link-dialog";
import { ChevronLeft, ChevronRight, Undo2 } from "lucide-react";
import { Progress, ProgressValue } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/utils/routes";
import { getBookCoverUrl } from "@/services/storage/book-repository";
import { getBookCoverVisual } from "@/shared/ornaments";

export const ReaderScreen: FC = () => {
  const navigate = useNavigate();
  const { bookId } = useParams();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [pendingExternalHref, setPendingExternalHref] = useState<string | null>(
    null,
  );

  const {
    readerDocument,
    parsedBook,
    isLoading,
    error,
    currentChapterIndex,
    progressPercent,
  } = readerStore();
  const hasFootnoteBackPosition = readerStore(
    (state) => state.footnoteBackStack.length > 0,
  );

  const totalChapters = parsedBook?.chapters.length ?? 0;

  const toc = parsedBook?.toc ?? [];

  const [coverUrl, setCoverUrl] = useState<string | undefined>(undefined);
  const [coverChecked, setCoverChecked] = useState(false);

  useEffect(() => {
    if (!bookId) return;

    let cancelled = false;
    void getBookCoverUrl(bookId).then((url) => {
      if (cancelled) return;
      setCoverUrl(url);
      setCoverChecked(true);
    });

    return () => {
      cancelled = true;
    };
  }, [bookId]);

  useEffect(() => {
    if (!bookId) return;

    void loadReaderBook(bookId).catch(() => {
      // errors are already captured in store.error by loadReaderBook
    });

    return () => {
      // Revoke all chapter asset blob URLs (images, fonts) before clearing
      // the store. Without this, every asset in the full book accumulates as
      // leaked object URLs for the lifetime of the browser tab.
      const { parsedBook } = readerStore.getState();
      if (parsedBook) {
        for (const chapter of parsedBook.chapters) {
          for (const blobUrl of chapter.assetMap.values()) {
            URL.revokeObjectURL(blobUrl);
          }
        }
      }
      readerStore.getState().reset();
    };
  }, [bookId]);

  const { jumpBack } = useReaderEngine({
    iframeRef,
    parsedBook,
    bookId,
    initialProgress: readerDocument?.book.progress ?? null,
    onExternalLink: setPendingExternalHref,
  });

  const handleTocItemClick = useCallback(
    (item: TocItem) => {
      const iframe = iframeRef.current;
      if (!iframe?.contentDocument || !iframe.contentWindow || !parsedBook) {
        return;
      }
      jumpToTocItem(
        item,
        iframe.contentDocument,
        iframe.contentWindow,
        parsedBook.chapters,
      );
    },
    [parsedBook],
  );

  const handleChapterNav = useCallback(
    (targetIndex: number) => {
      handleTocItemClick({
        label: "",
        href: "",
        chapterIndex: targetIndex,
        children: [],
      });
    },
    [handleTocItemClick],
  );

  if (isLoading) {
    const { palette, OrnamentComponent } = bookId
      ? getBookCoverVisual(bookId)
      : { palette: undefined, OrnamentComponent: undefined };

    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-background text-foreground">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt=""
            className="h-40 w-28 rounded-sm object-cover shadow-md"
          />
        ) : coverChecked && palette && OrnamentComponent ? (
          <div
            className={`flex h-40 w-28 items-center justify-center rounded-sm ${palette.gradient}`}
          >
            <OrnamentComponent className={`h-16 w-auto ${palette.accent}`} />
          </div>
        ) : (
          <div className="h-40 w-28 animate-pulse rounded-sm bg-muted" />
        )}

        {readerDocument ? (
          <div className="flex flex-col items-center gap-1">
            <p className="font-heading font-semibold text-center text-m tracking-wide">
              {readerDocument.book.title}
            </p>
            <p className="text-xs text-muted-foreground">
              {readerDocument.book.author}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="h-4 w-32 animate-pulse rounded-sm bg-muted" />
            <div className="h-3 w-20 animate-pulse rounded-sm bg-muted" />
          </div>
        )}

        <p className="text-xs text-muted-foreground">Loading reader...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="mb-2 font-semibold">Error loading book</p>
          <p className="text-muted-foreground text-sm">{error}</p>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => bookId && void loadReaderBook(bookId)}
            >
              Try again
            </Button>
            <Button onClick={() => navigate(ROUTES.LIBRARY)}>
              Back to library
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!readerDocument || !parsedBook) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background text-foreground">
        <p>No book loaded</p>
      </div>
    );
  }

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="folio-header flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Go back"
          onClick={() => navigate(-1)}
        >
          <ChevronLeft className="size-8" strokeWidth={1} />
        </Button>

        <div className="flex flex-col items-center gap-1">
          <h1 className="font-heading font-semibold text-center text-m tracking-wide">
            {readerDocument.book.title}
          </h1>
          <p className="text-xs text-muted-foreground">
            {readerDocument.book.author}
          </p>
        </div>

        <ReaderToolbar />
      </header>

      {/* Reader Content */}
      <main className="relative flex flex-1 overflow-hidden px-2">
        <ReaderFrame ref={iframeRef} />

        {hasFootnoteBackPosition && (
          <Button
            variant="secondary"
            size="sm"
            aria-label="Return to previous position"
            className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 shadow-floating"
            onClick={jumpBack}
          >
            <Undo2 className="size-4" strokeWidth={1.5} />
            Back
          </Button>
        )}
      </main>

      {/* Footer */}
      <footer className="folio-header flex flex-col gap-2">
        {/* Progress bar */}
        <Progress value={progressPercent} className="px-2 gap-1">
          <ProgressValue />
        </Progress>

        {/* Navigation */}
        <div className="flex justify-between items-center px-2">
          {/* TOC Drawer */}
          <TocDrawer
            toc={toc}
            currentChapterIndex={currentChapterIndex}
            onItemClick={handleTocItemClick}
          />
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Previous chapter"
              disabled={currentChapterIndex <= 0}
              onClick={() => handleChapterNav(currentChapterIndex - 1)}
            >
              <ChevronLeft className="size-4" strokeWidth={1.5} />
            </Button>

            <p className="metadata normal-case">
              {totalChapters > 0 ? currentChapterIndex + 1 : "–"}
              {totalChapters > 0 ? ` of ${totalChapters}` : ""}
            </p>

            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Next chapter"
              disabled={currentChapterIndex >= totalChapters - 1}
              onClick={() => handleChapterNav(currentChapterIndex + 1)}
            >
              <ChevronRight className="size-4" strokeWidth={1.5} />
            </Button>
          </div>
        </div>
      </footer>

      {/* External link confirmation */}
      <ExternalLinkDialog
        open={pendingExternalHref !== null}
        href={pendingExternalHref ?? ""}
        onConfirm={() => {
          if (!pendingExternalHref) return;

          window.open(pendingExternalHref, "_blank", "noopener,noreferrer");
          setPendingExternalHref(null);
        }}
        onOpenChange={(open) => {
          if (!open) {
            setPendingExternalHref(null);
          }
        }}
      />
    </div>
  );
};
