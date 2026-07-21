import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { Toast, ToastAction } from "@/components/toast/toast.types";

interface ShowOptions {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastStore {
  toasts: Toast[];
  show: (options: ShowOptions) => void;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  removeToast: (id: string) => void;
}

const AUTO_REMOVE_DELAYS: Record<Toast["type"], number> = {
  success: 3000,
  error: 4000,
  info: 6000,
};

export const toastStore = create<ToastStore>()(
  devtools(
    (set) => ({
      toasts: [],

      show: ({ message, actionLabel, onAction }) => {
        const id = crypto.randomUUID();

        const action: ToastAction | undefined =
          actionLabel && onAction
            ? { label: actionLabel, onClick: onAction }
            : undefined;

        set(
          (state) => ({
            toasts: [...state.toasts, { id, message, type: "info", action }],
          }),
          false,
          "toast/show",
        );

        setTimeout(() => {
          set(
            (state) => ({
              toasts: state.toasts.filter((toast) => toast.id !== id),
            }),
            false,
            "toast/autoRemove",
          );
        }, AUTO_REMOVE_DELAYS.info);
      },

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
