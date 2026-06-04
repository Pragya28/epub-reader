import type { FC } from "react";

export const SpinnerIcon: FC = () => {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      className="spinner-icon"
    >
      <circle
        cx="11"
        cy="11"
        r="8"
        stroke="currentColor"
        strokeWidth="2"
        strokeOpacity="0.25"
      />
      <path
        d="M11 3 A8 8 0 0 1 19 11"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
};
