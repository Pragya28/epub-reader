import { Fragment, type ReactNode } from "react";

interface CardGridProps<T> {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
}

/**
 * The auto-fill card grid shared by every "list of cards" screen —
 * BookGrid (Books tab, author screen, series screen) and the Shelves tab's
 * grouping grid. Generic over the item type since a book card and a
 * grouping card have nothing in common but "render into this layout."
 */
export function CardGrid<T>({ items, getKey, renderItem }: CardGridProps<T>) {
  return (
    <div
      className="grid gap-x-4 gap-y-5"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }}
    >
      {items.map((item) => (
        <Fragment key={getKey(item)}>{renderItem(item)}</Fragment>
      ))}
    </div>
  );
}
