import { useEffect, useRef } from "react";

/** How far a finger must travel before it counts as a swipe. */
const MIN_DISTANCE = 70;
/** Vertical slop allowed over that distance - beyond it, this was a scroll. */
const MAX_DRIFT = 55;
/** Longer than this and it was a drag, not a swipe. */
const MAX_DURATION_MS = 700;

/**
 * The drawer's swipe gestures: right anywhere to open it, left to put it back.
 *
 * Touch events only, deliberately: a mouse drag across the window is not a
 * gesture anyone means, and binding this to pointer events would fire it on
 * every desktop text selection.
 *
 * The exclusions matter more than the thresholds, and they differ by direction.
 * With the drawer shut, the player is covered in horizontal sliders - four
 * volumes, the tempo, the fine-tune - and every one of them is a rightward drag
 * that must not also open the drawer. With it open, the drawer itself is where
 * the finger will be, so it stops being excluded and becomes the thing being
 * swiped.
 */
export function useDrawerSwipe({ onOpen, onClose, drawerOpen, enabled = true }) {
  const startRef = useRef(null);

  // Refs, so the listeners can be bound once and still see current values -
  // rebinding four touch handlers every time the drawer opens would drop a
  // gesture already in progress.
  const stateRef = useRef({ onOpen, onClose, drawerOpen });
  stateRef.current = { onOpen, onClose, drawerOpen };

  useEffect(() => {
    if (!enabled) return;

    const isExcluded = (target) => {
      if (!target?.closest) return false;

      // Never, in either direction: the screensaver's whole job is to swallow
      // the next touch.
      if (target.closest(".screensaver.active")) return true;

      // Closing: the drawer is the surface being swiped, so it is fair game.
      if (stateRef.current.drawerOpen) return false;

      return !!(
        // Anything that is itself a horizontal drag.
        target.closest('input[type="range"]') ||
        // Overlays own their own gestures while they are up.
        target.closest(".tile-picker") ||
        target.closest(".mix-sheet.open") ||
        target.closest(".sidebar")
      );
    };

    const onTouchStart = (e) => {
      if (e.touches.length !== 1 || isExcluded(e.target)) {
        startRef.current = null;
        return;
      }
      const t = e.touches[0];
      startRef.current = { x: t.clientX, y: t.clientY, at: Date.now() };
    };

    const onTouchMove = (e) => {
      const start = startRef.current;
      if (!start) return;
      // Abandon as soon as the finger commits to vertical travel, so a scroll
      // that happens to drift sideways never moves the drawer.
      const t = e.touches[0];
      if (Math.abs(t.clientY - start.y) > MAX_DRIFT) startRef.current = null;
    };

    const onTouchEnd = (e) => {
      const start = startRef.current;
      startRef.current = null;
      if (!start) return;

      const t = e.changedTouches[0];
      const dx = t.clientX - start.x;
      const dy = Math.abs(t.clientY - start.y);

      if (dy > MAX_DRIFT || Date.now() - start.at > MAX_DURATION_MS) return;

      const { onOpen: open, onClose: close, drawerOpen: isOpen } = stateRef.current;

      if (isOpen) {
        if (dx <= -MIN_DISTANCE) close?.();
      } else if (dx >= MIN_DISTANCE) {
        open?.();
      }
    };

    // Passive: this only ever reads the gesture, so it must not stop the page
    // from scrolling while it decides.
    const opts = { passive: true };
    document.addEventListener("touchstart", onTouchStart, opts);
    document.addEventListener("touchmove", onTouchMove, opts);
    document.addEventListener("touchend", onTouchEnd, opts);
    document.addEventListener("touchcancel", onTouchEnd, opts);

    return () => {
      document.removeEventListener("touchstart", onTouchStart, opts);
      document.removeEventListener("touchmove", onTouchMove, opts);
      document.removeEventListener("touchend", onTouchEnd, opts);
      document.removeEventListener("touchcancel", onTouchEnd, opts);
    };
  }, [enabled]);
}
