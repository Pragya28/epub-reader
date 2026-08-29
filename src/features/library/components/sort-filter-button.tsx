import type { FC } from "react";
import { SlidersHorizontalIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";

interface SortFilterButtonProps {
  isFiltering: boolean;
  onClick: () => void;
  className?: string;
}

export const SortFilterButton: FC<SortFilterButtonProps> = ({
  isFiltering,
  onClick,
  className,
}) => (
  <Button
    variant="ghost"
    size="icon"
    aria-label="Sort and filter"
    onClick={onClick}
    className={`relative ${className ?? ""}`}
  >
    <SlidersHorizontalIcon weight="light" className="size-5" />
    {isFiltering && (
      <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-selected" />
    )}
  </Button>
);
