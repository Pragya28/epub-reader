import type { FC } from "react";

interface BookCountProps {
  total: number;
  /** Pass only while a filter is active, to render "visible / total". */
  visible?: number;
  finished?: number;
}

export const BookCount: FC<BookCountProps> = ({ total, visible, finished }) => {
  const books =
    visible === undefined
      ? `${total} ${total === 1 ? "book" : "books"}`
      : `${visible} / ${total} books`;

  return (
    <p aria-live="polite" className="text-sm text-muted-foreground">
      {finished === undefined ? books : `${books} • ${finished} Finished`}
    </p>
  );
};
