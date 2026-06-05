import type { FC } from "react";
import type { Toast as ToastType } from "./toast.types";

interface ToastProps {
  toast: ToastType;
}

export const Toast: FC<ToastProps> = ({ toast }) => {
  return (
    <div
      className={[
        "min-w-72 rounded-lg border px-2 py-2 shadow-sm text-sm text-center",
        toast.type === "success"
          ? "border-green-200 bg-green-50 text-green-900"
          : "border-red-200 bg-red-50 text-red-900",
      ].join(" ")}
    >
      {toast.message}
    </div>
  );
};
