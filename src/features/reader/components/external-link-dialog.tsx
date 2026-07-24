import type { FC } from "react";

interface ExternalLinkDialogProps {
  href: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ExternalLinkDialog: FC<ExternalLinkDialogProps> = ({
  href,
  onConfirm,
  onCancel,
}) => {
  // Show a readable version of the URL — strip protocol, truncate if long
  const display = href.replace(/^[a-z][a-z\d+\-.]*:\/\//i, "");

  return (
    <>
      {/* Backdrop */}
      <div
        className="absolute inset-0 z-30 bg-black/50"
        aria-hidden="true"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ext-link-title"
        className="absolute z-40 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-80 max-w-[85vw] surface rounded-xl shadow-floating p-5 flex flex-col gap-4"
      >
        <div className="flex flex-col gap-1">
          <h2
            id="ext-link-title"
            className="text-sm font-semibold text-primary"
          >
            Open external link?
          </h2>
          <p className="text-xs text-secondary break-all" title={href}>
            {display}
          </p>
        </div>

        <div className="flex gap-2 justify-end">
          <button
            className="px-3 py-1.5 text-xs rounded-md text-secondary hover:text-primary transition-colors"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="px-3 py-1.5 text-xs rounded-md bg-accent text-white hover:opacity-80 transition-opacity"
            onClick={onConfirm}
          >
            Open
          </button>
        </div>
      </div>
    </>
  );
};
