import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Our --text-* scale (see @theme in index.css) isn't in tailwind-merge's
// default font-size group, so it fell through to the text-color group and any
// `cn("text-title-sm ... text-foreground")` silently dropped the size.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "display-lg",
            "display-lg-mobile",
            "headline",
            "reading-lg",
            "reading-md",
            "title-sm",
            "ui",
            "ui-sm",
            "meta",
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
