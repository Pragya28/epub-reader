import type { FC } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

import { ROUTES } from "@/utils/routes";
import { Button } from "@/components/ui/button";
import { BookGrid } from "@/features/library/components/book-grid";
import { useAuthorScreen } from "@/features/library/hooks/use-author-screen";

export const LibraryAuthorScreen: FC = () => {
  const { author, isLoading, error, books } = useAuthorScreen();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="folio-header sticky top-0 z-50 px-5 flex items-center">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back to library"
          render={<Link to={ROUTES.LIBRARY} />}
        >
          <ChevronLeft strokeWidth={1.5} className="size-6" />
        </Button>
      </header>

      <main className="flex-1 px-4 pt-5 pb-10">
        <h1 className="section-title font-semibold text-foreground mb-5 leading-tight">
          {author}
        </h1>
        <BookGrid
          isLoading={isLoading}
          isSearch={false}
          error={error}
          books={books}
        />
      </main>
    </div>
  );
};
