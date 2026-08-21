import {
  useRef,
  useState,
  type FC,
  type PointerEvent,
  type ReactNode,
} from "react";
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

const LONG_PRESS_MS = 400;

/**
 * A speed-dial FAB: tapping the main button fans a row of icon-only
 * actions out along a quarter-circle arc (up toward the main button,
 * sweeping left) instead of a plain vertical stack. The radius is derived
 * from item count, gap, and button size — via the chord-length formula
 * `r = (size + gap) / (2·sin(angleBetween/2))` — so adding or removing an
 * action keeps consistent spacing automatically rather than needing
 * hand-tuned offsets per action.
 *
 * Two ways to trigger an action, since this is a touch-first app with no
 * hover state to reveal a label on:
 * - A quick tap runs the action immediately, no label shown.
 * - A press held past LONG_PRESS_MS shows a centered preview (icon + label
 *   + "Release to perform") — like an iOS peek — and releasing while held
 *   confirms it; dragging off the button before release cancels back to
 *   the closed-arc state without running anything.
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
  const [pressedIndex, setPressedIndex] = useState<number | null>(null);
  const [previewAction, setPreviewAction] = useState<ArcFabAction | null>(null);
  const n = actions.length;

  // Long-press bookkeeping lives in a ref, not state: the timeout callback
  // and the pointerup/click handlers all need to read/write it between
  // renders without triggering their own re-renders.
  const pressRef = useRef<{
    timer: ReturnType<typeof setTimeout> | null;
    confirmed: boolean;
    suppressClick: boolean;
  }>({ timer: null, confirmed: false, suppressClick: false });

  const radius =
    n <= 1
      ? buttonSize + gap
      : (buttonSize + gap) /
        (2 * Math.sin((arcSpan * (Math.PI / 180)) / (n - 1) / 2));

  const clearPress = () => {
    const state = pressRef.current;
    if (state.timer) clearTimeout(state.timer);
    state.timer = null;
    state.confirmed = false;
    setPressedIndex(null);
    setPreviewAction(null);
  };

  const runAction = (action: ArcFabAction) => {
    action.onClick();
    setOpen(false);
  };

  const handlePointerDown = (
    i: number,
    action: ArcFabAction,
    e: PointerEvent<HTMLButtonElement>,
  ) => {
    // Suppresses the click event a touch pointerup would otherwise still
    // fire — without this, a confirmed long-press double-runs the action.
    e.preventDefault();
    clearPress();
    pressRef.current.timer = setTimeout(() => {
      pressRef.current.confirmed = true;
      setPressedIndex(i);
      setPreviewAction(action);
    }, LONG_PRESS_MS);
  };

  const handlePointerUp = (action: ArcFabAction) => {
    if (pressRef.current.confirmed) {
      pressRef.current.suppressClick = true;
      runAction(action);
    }
    clearPress();
  };

  const handlePointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const inside =
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom;
    if (!inside) clearPress();
  };

  const handleClick = (action: ArcFabAction) => {
    if (pressRef.current.suppressClick) {
      pressRef.current.suppressClick = false;
      return;
    }
    runAction(action);
  };

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

      {previewAction && (
        <div className="pointer-events-none fixed inset-0 z-[45] flex flex-col items-center justify-center gap-2.5">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-foreground text-background">
            {previewAction.icon}
          </div>
          <p className="text-title-sm font-bold text-foreground">
            {previewAction.label}
          </p>
          <p className="text-ui-sm text-muted-foreground">Release to perform</p>
        </div>
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
            const isPressed = pressedIndex === i;

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
                  onPointerDown={(e) => handlePointerDown(i, action, e)}
                  onPointerUp={() => handlePointerUp(action)}
                  onPointerCancel={clearPress}
                  onPointerMove={handlePointerMove}
                  onClick={() => handleClick(action)}
                  aria-label={action.label}
                  disabled={!open}
                  size="icon"
                  style={{ width: buttonSize, height: buttonSize }}
                  className={cn(
                    "rounded-full shadow-floating transition-colors",
                    isPressed
                      ? "bg-foreground text-background"
                      : "bg-primary text-primary-foreground hover:bg-primary/90",
                  )}
                >
                  {action.icon}
                </Button>
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
