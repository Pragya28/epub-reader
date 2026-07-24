import type { TocItem } from "@/services/epub/epub-types";
import { flattenToc } from "../utils/flatten-toc";
import { CloseIcon } from "@/assets/icons/close-icon";

interface TocDrawerProps {
  toc: TocItem[];
  currentChapterIndex: number;
  onItemClick: (item: TocItem) => void;
  onClose: () => void;
}

export function TocDrawer({
  toc,
  currentChapterIndex,
  onItemClick,
  onClose,
}: TocDrawerProps) {
  // Flatten the nested tree into a display list with depth for indentation.
  // We render flat rather than recursively so we can use a single scrollable
  // list without any tricky nested-scroll issues.
  const flatItems = flattenToc(toc, 0);

  return (
    <>
      {/* Backdrop */}
      <div
        className="absolute inset-0 z-10 bg-black/40"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-label="Table of contents"
        className="absolute inset-y-0 left-0 z-20 w-80 max-w-[85vw] surface flex flex-col shadow-floating"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-divider">
          <h2 className="font-display text-base font-semibold text-primary">
            Contents
          </h2>
          <button
            className="text-secondary hover:text-primary transition-colors"
            aria-label="Close table of contents"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>

        <nav aria-label="Book chapters" className="flex-1 overflow-y-auto py-2">
          {flatItems.map(({ item, depth }, idx) => {
            const isActive = item.chapterIndex === currentChapterIndex;
            const isNavigable = item.chapterIndex >= 0;
            return (
              <button
                key={idx}
                disabled={!isNavigable}
                onClick={() => isNavigable && onItemClick(item)}
                className={[
                  "w-full text-left px-5 py-2.5 text-sm transition-colors",
                  "hover:bg-surface-high disabled:opacity-40 disabled:cursor-default",
                  isActive
                    ? "text-accent font-semibold bg-surface"
                    : "text-primary",
                ].join(" ")}
                style={{ paddingLeft: `${1.25 + depth * 1}rem` }}
                aria-current={isActive ? "true" : undefined}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}
