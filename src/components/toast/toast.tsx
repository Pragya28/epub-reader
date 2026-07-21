import type { FC } from "react";
import type { Toast as ToastType } from "./toast.types";

interface ToastProps {
  toast: ToastType;
}

export const Toast: FC<ToastProps> = ({ toast }) => {
  const styleMap: Record<string, string> = {
    success: "border-green-200 bg-green-50 text-green-900",
    error: "border-red-200 bg-red-50 text-red-900",
    info: "border-stone-200 bg-stone-50 text-stone-900",
  };

  return (
    <div
      className={[
        "min-w-72 rounded-lg border px-2 py-2 shadow-sm text-sm flex items-center justify-between gap-2",
        styleMap[toast.type] ?? styleMap.info,
      ].join(" ")}
    >
      <span>{toast.message}</span>
      {toast.action && (
        <button
          onClick={toast.action.onClick}
          className="shrink-0 font-medium text-accent hover:opacity-75 transition-opacity"
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
};
