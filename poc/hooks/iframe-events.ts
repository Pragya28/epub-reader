import React from "react";

interface UseIframeEventsProps {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  readingOrder: string[];
  setCurrentIndex: React.Dispatch<React.SetStateAction<number>>;
}

export function useIframeEvents({
  iframeRef,
  readingOrder,
  setCurrentIndex,
}: UseIframeEventsProps) {
  React.useEffect(() => {
    const iframeDoc = iframeRef.current?.contentDocument;
    if (!iframeDoc) return;

    const handleInternalLink = (href: string) => {
      const [file, anchor] = href.split("#");

      // Same-page anchor jump
      if (!file || file === "") {
        iframeDoc
          .getElementById(anchor)
          ?.scrollIntoView({ behavior: "smooth" });
        return;
      }

      const normalize = (p: string) => p.split("/").pop();
      const chapterPath = readingOrder.find(
        (path) => normalize(path) === normalize(file),
      );
      if (!chapterPath) return;

      const index = readingOrder.indexOf(chapterPath);
      if (index === -1) return;

      setCurrentIndex(index);

      setTimeout(() => {
        iframeDoc
          .getElementById(anchor)
          ?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    };

    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      if (
        href.startsWith("http") ||
        href.startsWith("mailto") ||
        href.startsWith("tel")
      ) {
        return;
      }

      e.preventDefault();
      handleInternalLink(href);
    };

    iframeDoc.addEventListener("click", handleClick);
    return () => iframeDoc.removeEventListener("click", handleClick);
  }, [readingOrder, setCurrentIndex]);
}
