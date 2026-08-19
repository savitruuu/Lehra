import { useEffect } from "react";

/**
 * Restricts every range input so it only moves when the thumb itself is held
 * and dragged; a tap on the track is ignored, and the drag runs at 65% of
 * pointer speed for finer control.
 *
 * Kept as one document-level listener rather than per-component handlers,
 * exactly as the pre-build app had it. It is genuinely global behaviour - it
 * applies to any range input anywhere in the app, including ones inside sheets
 * and pickers that mount and unmount - and expressing that as a single capture
 * listener is both less code and fewer places to forget.
 *
 * The one thing that changed for React: setting `input.value` directly is
 * invisible to React's value tracker, so a plain dispatch would leave onChange
 * unfired and the slider would snap back on the next render. Writing through
 * the prototype's own setter first is the standard fix.
 */
const SENSITIVITY = 0.65;

function setNativeValue(input, value) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  )?.set;
  if (setter) setter.call(input, String(value));
  else input.value = String(value);
}

export function useSliderDrag() {
  useEffect(() => {
    const onPointerDown = (e) => {
      const input = e.target;
      if (
        !input ||
        input.tagName !== "INPUT" ||
        input.type !== "range" ||
        input.disabled
      ) {
        return;
      }

      const rect = input.getBoundingClientRect();
      if (rect.width <= 0) return;

      const min = parseFloat(input.min) || 0;
      const max = parseFloat(input.max) || 100;
      const span = max - min;
      if (span <= 0) return;

      const val = parseFloat(input.value);
      const isCoarse = window.matchMedia("(pointer: coarse)").matches;
      const thumbWidth = isCoarse ? 28 : 20;
      const usableWidth = Math.max(1, rect.width - thumbWidth);

      const ratio = (val - min) / span;
      const thumbX = rect.left + thumbWidth / 2 + ratio * usableWidth;

      // Radius around the thumb centre considered a valid grab.
      const hitRadius = thumbWidth / 2 + 12;

      // Pointer down outside the sliding circle: swallow it, so a tap on the
      // track cannot jump the value.
      if (Math.abs(e.clientX - thumbX) > hitRadius) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      e.preventDefault();

      const startX = e.clientX;
      const startValue = val;
      const step = parseFloat(input.step) || 1;
      const pointerId = e.pointerId;

      try {
        input.setPointerCapture(pointerId);
      } catch {
        // Capture is a nicety; the move listener still works without it.
      }

      const onPointerMove = (moveEv) => {
        if (moveEv.pointerId !== pointerId) return;
        const dx = moveEv.clientX - startX;
        const deltaVal = (dx / usableWidth) * span * SENSITIVITY;

        let rawVal = Math.max(min, Math.min(max, startValue + deltaVal));
        let newValue = Math.round((rawVal - min) / step) * step + min;
        newValue = Math.max(min, Math.min(max, newValue));

        if (parseFloat(input.value) !== newValue) {
          setNativeValue(input, newValue);
          input.dispatchEvent(new Event("input", { bubbles: true }));
        }
      };

      const onPointerUp = (upEv) => {
        if (upEv.pointerId !== pointerId) return;
        input.removeEventListener("pointermove", onPointerMove);
        input.removeEventListener("pointerup", onPointerUp);
        input.removeEventListener("pointercancel", onPointerUp);
        try {
          input.releasePointerCapture(pointerId);
        } catch {
          // Already released - nothing to undo.
        }
        input.dispatchEvent(new Event("change", { bubbles: true }));
      };

      input.addEventListener("pointermove", onPointerMove);
      input.addEventListener("pointerup", onPointerUp);
      input.addEventListener("pointercancel", onPointerUp);
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, []);
}
