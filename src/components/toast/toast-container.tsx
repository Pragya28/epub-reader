import { Toast } from "./toast";
import { toastStore } from "@/stores/toast-store";

export const ToastContainer = () => {
  const toasts = toastStore((state) => state.toasts);

  if (!toasts.length) {
    return null;
  }

  return (
    <div className="fixed top-16 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} />
      ))}
    </div>
  );
};
