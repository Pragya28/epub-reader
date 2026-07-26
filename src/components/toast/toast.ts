import { toast } from "sonner";

export const notify = {
  success: (
    message: string,
    action?: {
      label: string;
      onClick: () => void;
    },
  ) => {
    toast.success(message, {
      action,
    });
  },

  error: (
    message: string,
    action?: {
      label: string;
      onClick: () => void;
    },
  ) => {
    toast.error(message, {
      action,
    });
  },

  info: (
    message: string,
    action?: {
      label: string;
      onClick: () => void;
    },
  ) => {
    toast(message, {
      action,
    });
  },
};
