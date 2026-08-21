import { useState, type FC, type ReactNode } from "react";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/button";

export interface ArcFabAction {
  id: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
}

interface ArcFabGroupProps {
  actions: ArcFabAction[];
  icon: ReactNode;
  activeIcon: ReactNode;
  ariaLabel: string;
  disabled?: boolean;
  /** Degrees the arc sweeps, from straight up (0°) toward the left
   * (arcSpan°). Fixed rather than per-action, since the whole point of the
   * auto-computed radius below is that spacing stays constant regardless
   * of how many actions there are. */
  arcSpan?: number;
  /** Px gap between adjacent action buttons along the arc. */
  gap?: number;
  /** Px diameter of each action button. */
  buttonSize?: number;
  /** Px diameter of the main button — also the group's own box size, since
   * the arc is measured from its center. Set explicitly (not inferred from
   * className) so the group's wrapper has a definite size to lay the arc
   * out against instead of two mutually-dependent auto-sized boxes. */
  mainButtonSize?: number;
  /** Positions the whole group, e.g. "fixed bottom-5 right-2". */
  className?: string;
  mainButtonClassName?: string;
}

/**
 * A speed-dial FAB: tapping the main button fans a row of labeled actions
 * out along a quarter-circle arc (up toward the main button, sweeping left)
 * instead of a plain vertical stack. The radius is derived from item count,
 * gap, and button size — via the chord-length formula
 * `r = (size + gap) / (2·sin(angleBetween/2))` — so adding or removing an
 * action keeps consistent spacing automatically rather than needing
 * hand-tuned offsets per action (see the git history of the first
 * hand-rolled version of this pattern for what that looked like).
 *
 * Labels are always visible while open, not hover-revealed: this is a
 * mobile-first touch app, and hover doesn't exist on touch.
 */
export const ArcFabGroup: FC<ArcFabGroupProps> = ({
  actions,
  icon,
  activeIcon,
  ariaLabel,
  disabled,
  arcSpan = 100,
  gap = 16,
  buttonSize = 48,
  mainButtonSize = 64,
  className,
  mainButtonClassName,
}) => {
  const [open, setOpen] = useState(false);
  const n = actions.length;

  const radius =
    n <= 1
      ? buttonSize + gap
      : (buttonSize + gap) /
        (2 * Math.sin((arcSpan * (Math.PI / 180)) / (n - 1) / 2));

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 transition-opacity duration-150"
        />
      )}

      <div
        style={{ width: mainButtonSize, height: mainButtonSize }}
        className={cn("z-50", className)}
      >
        <div className="absolute inset-0" aria-hidden={!open}>
          {actions.map((action, i) => {
            const angleDeg = n === 1 ? arcSpan / 2 : i * (arcSpan / (n - 1));
            const angleRad = angleDeg * (Math.PI / 180);
            const cx = -radius * Math.sin(angleRad);
            const cy = -radius * Math.cos(angleRad);

            return (
              <div
                key={action.id}
                style={{
                  width: buttonSize,
                  height: buttonSize,
                  transitionDelay: open
                    ? `${i * 45}ms`
                    : `${(n - 1 - i) * 35}ms`,
                  transform: open
                    ? `translate(-50%, -50%) translate(${cx}px, ${cy}px) scale(1)`
                    : "translate(-50%, -50%) translate(0, 0) scale(0.4)",
                  opacity: open ? 1 : 0,
                }}
                className="absolute top-1/2 left-1/2 flex items-center justify-center transition-[transform,opacity] duration-200 ease-out"
              >
                <Button
                  onClick={() => {
                    setOpen(false);
                    action.onClick();
                  }}
                  aria-label={action.label}
                  disabled={!open}
                  size="icon"
                  style={{ width: buttonSize, height: buttonSize }}
                  className="rounded-full bg-primary text-primary-foreground shadow-floating hover:bg-primary/90"
                >
                  {action.icon}
                </Button>
                <span className="absolute right-full mr-2 rounded-sm bg-popover px-3 py-1.5 text-ui-sm font-medium text-popover-foreground shadow-md ring-1 ring-foreground/10 whitespace-nowrap">
                  {action.label}
                </span>
              </div>
            );
          })}
        </div>

        <Button
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          disabled={disabled}
          aria-label={open ? "Close" : ariaLabel}
          aria-expanded={open}
          style={{ width: mainButtonSize, height: mainButtonSize }}
          className={cn(
            "relative rounded-2xl shadow-floating opacity-90 hover:opacity-100 disabled:opacity-60 transition-transform duration-150",
            mainButtonClassName,
          )}
        >
          {open ? activeIcon : icon}
        </Button>
      </div>
    </>
  );
};
