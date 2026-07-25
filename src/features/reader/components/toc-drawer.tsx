import type { TocItem } from "@/services/epub/epub-types";
import { flattenToc } from "../utils/flatten-toc";

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
  const flatItems = flattenToc(toc, 0);

  return (
    <>
      {/* Backdrop */}
      <div
        className="absolute inset-0 z-10 bg-black/40 backdrop-blur-sm"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Bottom sheet */}
      <div className="absolute inset-x-0 bottom-0 z-20 flex max-h-[85%] flex-col rounded-t-3xl surface shadow-floating">
        {/* Handle */}
        <div className="flex flex-col items-center border-b border-divider px-6 pt-3 pb-5">
          <div className="mb-4 h-1.5 w-12 rounded-full bg-divider" />

          <h2 className="font-display text-base font-semibold tracking-[0.18em] text-primary">
            Contents
          </h2>
        </div>

        {/* List */}
        <nav
          aria-label="Book chapters"
          className="flex-1 overflow-y-auto px-2 py-2"
        >
          <div className="flex flex-col gap-2">
            {flatItems.map(({ item }, idx) => {
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
                  aria-current={isActive ? "true" : undefined}
                >
                  <div className="flex flex-col items-center text-center">
                    <span
                      className={[
                        "font-reading text-m italic leading-tight",
                        isActive ? "font-semibold" : "",
                      ].join(" ")}
                    >
                      {item.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </>
  );
}
