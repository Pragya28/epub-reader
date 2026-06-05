import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { Toast } from "@/components/toast/toast.types";

interface ToastStore {
  toasts: Toast[];
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  removeToast: (id: string) => void;
}

export const toastStore = create<ToastStore>()(
  devtools(
    (set) => ({
      toasts: [],

      showSuccess: (message) => {
        const id = crypto.randomUUID();

        set(
          (state) => ({
            toasts: [
              ...state.toasts,
              {
                id,
                message,
                type: "success",
              },
            ],
          }),
          false,
          "toast/showSuccess",
        );

        setTimeout(() => {
          set(
            (state) => ({
              toasts: state.toasts.filter((toast) => toast.id !== id),
            }),
            false,
            "toast/autoRemove",
          );
        }, 3000);
      },

      showError: (message) => {
        const id = crypto.randomUUID();

        set(
          (state) => ({
            toasts: [
              ...state.toasts,
              {
                id,
                message,
                type: "error",
              },
            ],
          }),
          false,
          "toast/showError",
        );

        setTimeout(() => {
          set(
            (state) => ({
              toasts: state.toasts.filter((toast) => toast.id !== id),
            }),
            false,
            "toast/autoRemove",
          );
        }, 4000);
      },

      removeToast: (id) =>
        set(
          (state) => ({
            toasts: state.toasts.filter((toast) => toast.id !== id),
          }),
          false,
          "toast/removeToast",
        ),
    }),
    {
      name: "ToastStore",
    },
  ),
);
