import JSZip from "jszip";
import React from "react";
import { resolveChapterImages } from "../handlers/resolve-chapter-images";

interface UseChapterRendererProps {
  zipFile: JSZip | null;
  readingOrder: string[];
  combinedCss: string;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  chapterBlobUrlsRef: React.RefObject<string[]>;
  loadedChaptersRef: React.RefObject<Set<number>>;
  renderChapterRef: React.RefObject<(index: number) => Promise<void>>;
}

export function useChapterRenderer({
  zipFile,
  readingOrder,
  combinedCss,
  iframeRef,
  chapterBlobUrlsRef,
  loadedChaptersRef,
  renderChapterRef,
}: UseChapterRendererProps) {
  const renderChapter = async (index: number) => {
    if (!zipFile || !readingOrder[index]) return;

    const iframeDoc = iframeRef.current?.contentDocument;
    if (!iframeDoc) return;

    // Inject CSS once, on the very first chapter render
    if (combinedCss && loadedChaptersRef.current.size === 0) {
      const styleEl = iframeDoc.createElement("style");
      styleEl.textContent = combinedCss;
      iframeDoc.head.appendChild(styleEl);
    }

    // Prevent duplicate renders
    if (loadedChaptersRef.current.has(index)) return;
    loadedChaptersRef.current.add(index);

    const chapterPath = readingOrder[index];
    const chapterFile = zipFile.file(chapterPath);
    if (!chapterFile) return;

    const chapterContent = await chapterFile.async("string");
    const chapterDoc = new DOMParser().parseFromString(
      chapterContent,
      "application/xhtml+xml",
    );

    const chapterBasePath = chapterPath.substring(
      0,
      chapterPath.lastIndexOf("/") + 1,
    );
    const { blobUrls } = await resolveChapterImages(
      chapterDoc,
      chapterBasePath,
      zipFile,
    );
    chapterBlobUrlsRef.current.push(...blobUrls);

    const wrapper = iframeDoc.createElement("section");
    wrapper.setAttribute("data-chapter", String(index));
    wrapper.style.marginBottom = "48px";
    wrapper.innerHTML = chapterDoc.body.innerHTML;

    // Insert in reading order
    let inserted = false;
    iframeDoc.querySelectorAll("section[data-chapter]").forEach((section) => {
      const existingIndex = Number(section.getAttribute("data-chapter"));
      if (!inserted && existingIndex > index) {
        iframeDoc.body.insertBefore(wrapper, section);
        inserted = true;
      }
    });
    if (!inserted) iframeDoc.body.appendChild(wrapper);
  };

  // Keep renderChapterRef current so the scroll engine always has the latest
  // version without needing renderChapter as a dep of the scroll effect.
  React.useEffect(() => {
    renderChapterRef.current = renderChapter;
  }, [renderChapter]);

  return { renderChapter };
}
