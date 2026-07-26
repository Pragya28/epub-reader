import { useEffect, useRef, useState, useCallback, type FC } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { loadReaderBook } from "@/features/reader/actions/load-reader-book";
import { jumpToTocItem } from "@/features/reader/actions/jump-to-toc-item";
import { ReaderFrame } from "@/features/reader/components/reader-frame";
import { useReaderEngine } from "@/features/reader/hooks/use-reader-engine";
import { readerStore } from "@/features/reader/store/reader-store";
import type { TocItem } from "@/services/epub/epub-types";
import { TocDrawer } from "@/features/reader/components/toc-drawer";
import { ExternalLinkDialog } from "@/features/reader/components/external-link-dialog";
import { ChevronLeft } from "lucide-react";
import { Progress, ProgressValue } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

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

  const totalChapters = parsedBook?.chapters.length ?? 0;

  const toc = parsedBook?.toc ?? [];

  useEffect(() => {
    if (!bookId) return;

    void loadReaderBook(bookId).catch(() => {
      // errors are already captured in store.error by loadReaderBook
    });

    return () => {
      readerStore.getState().reset();
    };
  }, [bookId]);

  useReaderEngine({
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

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <p>Loading reader...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <p className="mb-2 font-semibold">Error loading book</p>
          <p className="text-muted-foreground text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!readerDocument || !parsedBook) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <p>No book loaded</p>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-background">
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

        <Button variant="ghost" size="icon" className="invisible" />
      </header>

      {/* Reader Content */}
      <main className="flex flex-1 overflow-hidden px-2">
        <ReaderFrame ref={iframeRef} />
      </main>

      {/* Footer */}
      <footer className="folio-header flex flex-col gap-2">
        {/* Progress bar */}
        <Progress
          value={progressPercent}
          className="w-full max-w-sm px-2 gap-1"
        >
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
          <p className="metadata normal-case">
            {totalChapters > 0 ? currentChapterIndex + 1 : "–"}
            {totalChapters > 0 ? ` of ${totalChapters}` : ""}
          </p>
          <div className="w-5" />
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
