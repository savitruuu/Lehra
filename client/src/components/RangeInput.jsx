import { useEffect, useRef } from "react";

/**
 * A range input that paints its travelled portion.
 *
 * A range input paints one flat track either side of its thumb, with no way in
 * CSS alone to colour only the part behind it. The stylesheet draws the track
 * as a two-stop gradient and reads the stop position from `--fill`, which this
 * keeps up to date - as an inline style off the current value rather than the
 * pre-build app's global "input" listener, so the fill can never be a frame
 * behind what is rendered.
 *
 * `onCommit` fires on release (the native "change"), for the two controls where
 * applying continuously would be too heavy: the tanpura's tempo, which may have
 * to build a new time-stretched buffer, and the fine-tune bend, which rebuilds
 * a running drone.
 */
export function RangeInput({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  onCommit,
  ...rest
}) {
  const ref = useRef(null);
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;

  // React's onChange is the native "input" event, so release has to be wired
  // up by hand.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = () => commitRef.current?.(Number(el.value));
    el.addEventListener("change", handler);
    return () => el.removeEventListener("change", handler);
  }, []);

  const span = max - min;
  const pct = span > 0 ? ((value - min) / span) * 100 : 0;

  return (
    <input
      ref={ref}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange?.(Number(e.target.value))}
      style={{ "--fill": `${Math.max(0, Math.min(100, pct))}%` }}
      {...rest}
    />
  );
}
