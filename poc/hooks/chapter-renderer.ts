import JSZip from "jszip";
import React from "react";
import { resolveChapterImages } from "../handlers/resolve-chapter-images";

interface UseChapterRendererProps {
  zipFile: JSZip | null;
  readingOrder: string[];
  combinedCss: string;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  chapterBlobUrlsRef: React.RefObject<Map<number, string[]>>;
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

    if (loadedChaptersRef.current.has(index)) return;

    try {
      const chapterPath = readingOrder[index];
      const chapterFile = zipFile.file(chapterPath);
      if (!chapterFile) return;

      // Inject CSS once
      if (combinedCss && loadedChaptersRef.current.size === 0) {
        const styleEl = iframeDoc.createElement("style");
        styleEl.textContent = combinedCss;
        iframeDoc.head.appendChild(styleEl);
      }

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

      // store all blob urls for this chapter
      chapterBlobUrlsRef.current.set(index, blobUrls);

      const wrapper = iframeDoc.createElement("section");
      wrapper.setAttribute("data-chapter", String(index));
      wrapper.style.marginBottom = "48px";
      wrapper.innerHTML = chapterDoc.body.innerHTML;

      // insert in reading order
      let inserted = false;

      iframeDoc.querySelectorAll("section[data-chapter]").forEach((section) => {
        const existingIndex = Number(section.getAttribute("data-chapter"));

        if (!inserted && existingIndex > index) {
          iframeDoc.body.insertBefore(wrapper, section);
          inserted = true;
        }
      });

      if (!inserted) iframeDoc.body.appendChild(wrapper);

      loadedChaptersRef.current.add(index);
    } catch (err) {
      loadedChaptersRef.current.delete(index);
      console.error("Failed to render chapter", err);
    }
  };

  React.useEffect(() => {
    renderChapterRef.current = renderChapter;
  }, [renderChapter]);

  return { renderChapter };
}
