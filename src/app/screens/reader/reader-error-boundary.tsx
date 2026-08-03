import type { FC, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ErrorBoundary } from "@/components/error-boundary/error-boundary";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/utils/routes";

interface ReaderErrorBoundaryProps {
  children: ReactNode;
}

export const ReaderErrorBoundary: FC<ReaderErrorBoundaryProps> = ({
  children,
}) => {
  const navigate = useNavigate();

  return (
    <ErrorBoundary
      fallback={(error, reset) => (
        <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
          <p className="font-semibold">This book couldn't be displayed</p>

          <p className="max-w-sm text-sm text-muted-foreground">
            {error.message}
          </p>

          <div className="flex gap-2">
            <Button variant="outline" onClick={reset}>
              Try again
            </Button>
            <Button onClick={() => navigate(ROUTES.LIBRARY)}>
              Back to library
            </Button>
          </div>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
};
