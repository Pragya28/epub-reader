import { useEffect, useRef } from "react";
import { renderChapter } from "../engine/renderer/chapter-renderer";
import type { ParsedChapter } from "@/services/epub/epub-types";

interface Props {
  chapterHtml: ParsedChapter;
}

export function ReaderFrame({ chapterHtml }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;

    if (!iframe) return;

    renderChapter(iframe, chapterHtml);
  }, [chapterHtml]);

  return (
    <iframe
      sandbox="allow-same-origin"
      ref={iframeRef}
      className="h-full w-full border-0"
      title="reader"
    />
  );
}
