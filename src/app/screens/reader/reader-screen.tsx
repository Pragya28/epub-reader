import type { FC } from "react";
import { useReaderScreen } from "@/features/reader/hooks/use-reader-screen";
import { ReaderFrame } from "@/features/reader/components/reader-frame";
import { TocDrawer } from "@/features/reader/components/toc-drawer";
import { ReaderToolbar } from "@/features/reader/components/reader-toolbar";
import { ExternalLinkDialog } from "@/features/reader/components/external-link-dialog";
import { ChevronLeft, ChevronRight, Undo2 } from "lucide-react";
import { Progress, ProgressValue } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { getBookCoverVisual } from "@/shared/ornaments";
import { ContinueReadingBanner } from "@/features/library/components/continue-reading-banner";

export const ReaderScreen: FC = () => {
  const {
    bookId,
    iframeRef,
    readerDocument,
    parsedBook,
    isLoading,
    error,
    currentChapterIndex,
    progressPercent,
    hasFootnoteBackPosition,
    isJumping,
    totalChapters,
    toc,
    nextBook,
    coverUrl,
    coverChecked,
    pendingExternalHref,
    setPendingExternalHref,
    confirmExternalLink,
    chromeVisible,
    setChromeOverlay,
    revealChrome,
    handleTocItemClick,
    handleChapterNav,
    jumpBack,
    goBack,
    goToLibrary,
    retryLoad,
  } = useReaderScreen();

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
            <p className="font-heading font-semibold text-center text-title-sm tracking-wide">
              {readerDocument.book.title}
            </p>
            <p className="text-ui-sm text-muted-foreground">
              {readerDocument.book.author}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="h-4 w-32 animate-pulse rounded-sm bg-muted" />
            <div className="h-3 w-20 animate-pulse rounded-sm bg-muted" />
          </div>
        )}

        <p className="text-ui-sm text-muted-foreground">Loading reader...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="font-semibold">Error loading book</p>
          <p className="text-muted-foreground text-ui">{error}</p>

          <div className="flex gap-2">
            <Button variant="outline" onClick={retryLoad}>
              Try again
            </Button>
            <Button onClick={goToLibrary}>Back to library</Button>
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
    <div className="relative h-dvh overflow-hidden bg-background">
      {/* Header */}
      <header
        onFocusCapture={revealChrome}
        className={`folio-header absolute inset-x-0 top-0 z-20 flex items-center justify-between transition-[transform,opacity] duration-300 ease-out ${
          chromeVisible
            ? "translate-y-0 opacity-100"
            : "-translate-y-full opacity-0 pointer-events-none"
        }`}
      >
        <Button
          variant="ghost"
          size="icon"
          aria-label="Go back"
          onClick={goBack}
        >
          <ChevronLeft className="size-8" strokeWidth={1} />
        </Button>

        <div className="flex flex-col items-center gap-1">
          <h1 className="font-heading font-semibold text-center text-title-sm tracking-wide">
            {readerDocument.book.title}
          </h1>
          <p className="text-ui-sm text-muted-foreground">
            {readerDocument.book.author}
          </p>
        </div>

        <ReaderToolbar onOpenChange={setChromeOverlay} />
      </header>

      {/* Reader Content */}
      <main className="absolute inset-0 flex overflow-hidden px-2">
        <ReaderFrame ref={iframeRef} title={readerDocument.book.title} />

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
      <footer
        onFocusCapture={revealChrome}
        className={`folio-header absolute inset-x-0 bottom-0 z-20 flex flex-col gap-2 transition-[transform,opacity] duration-300 ease-out ${
          chromeVisible
            ? "translate-y-0 opacity-100"
            : "translate-y-full opacity-0 pointer-events-none"
        }`}
      >
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
            onOpenChange={setChromeOverlay}
          />
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Previous chapter"
              disabled={currentChapterIndex <= 0 || isJumping}
              onClick={() => handleChapterNav(-1)}
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
              disabled={currentChapterIndex >= totalChapters - 1 || isJumping}
              onClick={() => handleChapterNav(1)}
            >
              <ChevronRight className="size-4" strokeWidth={1.5} />
            </Button>
          </div>
        </div>

        {/* "Next in series" — an in-flow row inside this same fixed footer,
            not a second floating overlay, so it can never overlap the
            chapter-nav row above it (Sprint 7 Day 4 audit finding). */}
        {nextBook && (
          <div className="px-2 pb-1">
            <ContinueReadingBanner
              book={nextBook}
              label="Next book"
              variant="inline"
            />
          </div>
        )}
      </footer>

      {/* External link confirmation */}
      <ExternalLinkDialog
        open={pendingExternalHref !== null}
        href={pendingExternalHref ?? ""}
        onConfirm={confirmExternalLink}
        onOpenChange={(open) => {
          if (!open) {
            setPendingExternalHref(null);
            setChromeOverlay(false);
          }
        }}
      />
    </div>
  );
};
