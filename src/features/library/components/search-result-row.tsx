import type { FC } from "react";

interface SearchResultRowProps {
  title: string;
  author: string;
  coverUrl: string | undefined;
  chapterLabel?: string;
  snippet?: string;
  highlightWord?: string;
  onClick?: () => void;
}

function renderSnippet(snippet: string, highlightWord?: string) {
  if (!highlightWord) return snippet;

  const index = snippet.toLowerCase().indexOf(highlightWord.toLowerCase());
  if (index === -1) return snippet;

  const before = snippet.slice(0, index);
  const match = snippet.slice(index, index + highlightWord.length);
  const after = snippet.slice(index + highlightWord.length);

  return (
    <>
      {before}
      <mark className="rounded-sm bg-cover-gold/35 font-semibold text-selected not-italic">
        {match}
      </mark>
      {after}
    </>
  );
}

export const SearchResultRow: FC<SearchResultRowProps> = ({
  title,
  author,
  coverUrl,
  chapterLabel,
  snippet,
  highlightWord,
  onClick,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full gap-3.5 py-3.5 text-left"
    >
      <div className="aspect-2/3 w-14 shrink-0 overflow-hidden rounded-sm bg-card shadow-sm">
        {coverUrl && (
          <img src={coverUrl} alt="" className="size-full object-cover" />
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="font-ui text-sm font-semibold text-foreground">
          {title}
        </div>
        <div className="font-ui text-meta tracking-wide text-muted-foreground uppercase">
          {author}
        </div>
        {chapterLabel && (
          <div className="mt-1 font-ui text-meta tracking-wide text-muted-foreground">
            {chapterLabel}
          </div>
        )}
        {snippet && (
          <div className="font-reading mt-0.5 text-title-sm leading-snug text-foreground italic">
            {renderSnippet(snippet, highlightWord)}
          </div>
        )}
      </div>
    </button>
  );
};
