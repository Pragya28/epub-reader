import { Toaster as UIToaster } from "@/components/ui/sonner";

export function Toaster() {
  return (
    <UIToaster
      theme="system"
      position="top-center"
      richColors
      toastOptions={{
        classNames: {
          toast: "bg-card text-card-foreground border-border shadow-soft",
          title: "font-medium",
          description: "text-muted-foreground",
          actionButton: "bg-accent text-accent-foreground hover:bg-accent/90",
          cancelButton: "bg-muted text-muted-foreground hover:bg-muted/80",
        },
      }}
    />
  );
}
