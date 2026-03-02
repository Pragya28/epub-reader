import { useEffect, useRef, useState } from "react";
import JSZip from "jszip";

interface Chapter {
  title: string;
  content: string;
  css?: string;
}

export default function App() {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [current, setCurrent] = useState<Chapter | null>(null);
  const [bookTitle, setBookTitle] = useState("");
  const [bookCss, setBookCss] = useState("");
  const zipRef = useRef<JSZip | null>(null);

  async function resolveImages(
    html: string,
    zip: JSZip,
    opfDir: string,
  ): Promise<string> {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const imgs = doc.querySelectorAll("img");

    await Promise.all(
      Array.from(imgs).map(async (img) => {
        const src = img.getAttribute("src");
        if (!src) return;

        // Resolve the path relative to the OPF directory
        const fullPath = opfDir + src.replace(/^\.\.\//, "");
        const imageFile = zip.file(fullPath);
        if (!imageFile) return;

        const blob = await imageFile.async("blob");
        const url = URL.createObjectURL(blob);
        img.setAttribute("src", url);
      }),
    );

    return doc.documentElement.outerHTML;
  }

  function injectLinkInterceptor(html: string): string {
    const script = `
      <script>
        document.addEventListener('click', function(e) {
          const a = e.target.closest('a');
          if (!a) return;
          const href = a.getAttribute('href');
          if (!href) return;

          // Let in-page anchor links work natively
          if (href.startsWith('#')) return;

          // Everything else — send to parent
          e.preventDefault();
          window.parent.postMessage({ type: 'LINK_CLICK', href }, '*');
        });
      </script>
    `;
    return html.replace("</body>", script + "</body>");
  }

  function extractBodyContent(html: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    return doc.body.innerHTML;
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const zip = await JSZip.loadAsync(file);
    zipRef.current = zip;

    // 1. Find and parse the OPF file (the book's manifest)
    const containerXml = await zip
      .file("META-INF/container.xml")
      ?.async("string");
    if (!containerXml) return alert("Invalid EPUB");

    const parser = new DOMParser();
    const containerDoc = parser.parseFromString(
      containerXml,
      "application/xml",
    );
    const opfPath = containerDoc
      .querySelector("rootfile")
      ?.getAttribute("full-path");
    if (!opfPath) return alert("Cannot find OPF");

    const opfXml = await zip.file(opfPath)?.async("string");
    if (!opfXml) return;

    const opfDoc = parser.parseFromString(opfXml, "application/xml");
    const opfDir = opfPath.includes("/")
      ? opfPath.split("/").slice(0, -1).join("/") + "/"
      : "";

    // 2. Extract title
    const title = opfDoc.querySelector("title")?.textContent ?? "Unknown Title";
    setBookTitle(title);

    // 3. Build id→href map from manifest
    const manifestItems: Record<string, string> = {};
    opfDoc.querySelectorAll("manifest item").forEach((item) => {
      const id = item.getAttribute("id");
      const href = item.getAttribute("href");
      if (id && href) manifestItems[id] = href;
    });

    const cssFiles: Record<string, string> = {};
    for (const [id, href] of Object.entries(manifestItems)) {
      if (href.endsWith(".css")) {
        const fullPath = opfDir + href;
        const css = await zip.file(fullPath)?.async("string");
        if (css) cssFiles[href] = css;
      }
    }

    // 4. Read spine order
    const spineIds = Array.from(opfDoc.querySelectorAll("spine itemref"))
      .map((el) => el.getAttribute("idref"))
      .filter(Boolean) as string[];

    // 5. Load each chapter's HTML content
    const loaded: Chapter[] = [];
    for (const id of spineIds) {
      const href = manifestItems[id];
      if (!href) continue;
      const fullPath = opfDir + href;
      const content = await zip.file(fullPath)?.async("string");
      if (content) {
        const resolved = await resolveImages(content, zip, opfDir);
        const injected = injectLinkInterceptor(resolved);
        loaded.push({ title: href, content: injected });
      }
    }

    setChapters(loaded);
    setCurrent(loaded[0] ?? null);
    setBookCss(Object.values(cssFiles).join("\n"));
  }

  // useEffect(() => {
  //   function handleMessage(e: MessageEvent) {
  //     if (e.data?.type !== "LINK_CLICK") return;
  //     const href: string = e.data.href;

  //     // Strip any directory prefix and query strings
  //     const filename = href.split("/").pop()?.split("?")[0].split("#")[0];
  //     if (!filename) return;

  //     const target = chapters.find(
  //       (ch) => ch.title.split("/").pop() === filename,
  //     );
  //     if (target) setCurrent(target);
  //   }

  //   window.addEventListener("message", handleMessage);
  //   return () => window.removeEventListener("message", handleMessage);
  // }, [chapters]);

  return (
    <>
      {bookCss && <style>{bookCss}</style>}
      <div
        style={{
          display: "flex",
          height: "100vh",
          fontFamily: "sans-serif",
          width: "100vw",
        }}
      >
        {/* Sidebar */}
        <div
          style={{
            width: 240,
            borderRight: "1px solid #ddd",
            padding: 16,
            overflowY: "auto",
          }}
        >
          <input type="file" accept=".epub" onChange={handleFile} />
          {bookTitle && (
            <h2 style={{ marginTop: 16, fontSize: 14 }}>{bookTitle}</h2>
          )}
          <ul style={{ marginTop: 16, listStyle: "none", padding: 0 }}>
            {chapters.map((ch, i) => (
              <li key={i}>
                <button
                  onClick={() =>
                    document
                      .getElementById(`chapter-${i}`)
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                  style={{
                    background: current === ch ? "#eee" : "none",
                    border: "none",
                    padding: "8px 4px",
                    width: "100%",
                    textAlign: "left",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  {i + 1}. {ch.title.split("/").pop()}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Reader */}
        {/*<div style={{ flex: 1 }}>
        {current ? (
          <iframe
            key={current.title}
            srcDoc={current.content}
            style={{ width: "100%", height: "100%", border: "none" }}
            sandbox="allow-same-origin allow-scripts"
            title="Chapter content"
          />
        ) : (
          <div style={{ padding: 32, color: "#999" }}>
            Open an EPUB file to start reading.
          </div>
        )}
      </div>*/}
        <div
          onClick={(e) => {
            const a = (e.target as HTMLElement).closest("a");
            if (!a) return;
            const href = a.getAttribute("href");
            if (!href || href.startsWith("#")) return;
            e.preventDefault();
            const filename = href.split("/").pop()?.split("?")[0].split("#")[0];
            const idx = chapters.findIndex(
              (ch) => ch.title.split("/").pop() === filename,
            );
            if (idx !== -1) {
              document
                .getElementById(`chapter-${idx}`)
                ?.scrollIntoView({ behavior: "smooth" });
            }
          }}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "0 2rem",
          }}
        >
          {chapters.map((ch, i) => (
            <div
              key={ch.title}
              id={`chapter-${i}`}
              style={{
                maxWidth: 680,
                margin: "0 auto",
                paddingBottom: "4rem",
                borderBottom: "1px solid #eee",
              }}
              dangerouslySetInnerHTML={{
                __html: extractBodyContent(ch.content),
              }}
            />
          ))}
        </div>
      </div>
    </>
  );
}
