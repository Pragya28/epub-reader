import { forwardRef } from "react";

export const ReaderFrame = forwardRef<HTMLIFrameElement>((_props, ref) => {
  return (
    <iframe
      sandbox="allow-same-origin"
      ref={ref}
      className="h-full w-full border-0"
      title="reader"
      tabIndex={0}
    />
  );
});

ReaderFrame.displayName = "ReaderFrame";
