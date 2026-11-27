import type { FC } from "react";

interface BookCountProps {
  total: number;
  /** Pass only while a filter is active, to render "visible / total". */
  visible?: number;
}

export const BookCount: FC<BookCountProps> = ({ total, visible }) => (
  <p aria-live="polite" className="text-sm text-muted-foreground">
    {visible === undefined
      ? `${total} ${total === 1 ? "book" : "books"}`
      : `${visible} / ${total} books`}
  </p>
);
