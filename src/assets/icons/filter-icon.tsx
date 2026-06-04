import type { FC } from "react";

export const FilterIcon: FC = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    {/* three horizontal lines with dot handles — matches image's filter icon */}
    <circle cx="7" cy="6" r="2" stroke="currentColor" strokeWidth="1.5" />
    <line
      x1="1"
      y1="6"
      x2="5"
      y2="6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <line
      x1="9"
      y1="6"
      x2="21"
      y2="6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <circle cx="15" cy="11" r="2" stroke="currentColor" strokeWidth="1.5" />
    <line
      x1="1"
      y1="11"
      x2="13"
      y2="11"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <line
      x1="17"
      y1="11"
      x2="21"
      y2="11"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <circle cx="9" cy="16" r="2" stroke="currentColor" strokeWidth="1.5" />
    <line
      x1="1"
      y1="16"
      x2="7"
      y2="16"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <line
      x1="11"
      y1="16"
      x2="21"
      y2="16"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);
