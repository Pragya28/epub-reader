import { forwardRef } from "react";

interface ReaderFrameProps {
  /** Book title — names the frame for screen readers (WCAG 2.4.1, 4.1.2). */
  title: string;
}

export const ReaderFrame = forwardRef<HTMLIFrameElement, ReaderFrameProps>(
  ({ title }, ref) => {
    return (
      <iframe
        sandbox="allow-same-origin"
        ref={ref}
        className="h-full w-full border-0"
        title={title}
        tabIndex={0}
      />
    );
  },
);

ReaderFrame.displayName = "ReaderFrame";
