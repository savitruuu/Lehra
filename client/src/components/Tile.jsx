import { useRef } from "react";
import { useUI } from "../ui/UIContext.jsx";

/**
 * A launcher tile: the name of a setting, the option it is currently on, and a
 * tap that opens the anchored list.
 *
 * `.control-label` and `.tile-value` are ordered by CSS (`order: 1` / `order:
 * 2`) rather than by their place in the markup, which is a leftover from the
 * pre-build layout appending the relocated <label> after the value span. Left
 * alone: the stylesheet is the same file, and reordering here to match would
 * only make the two disagree.
 */
export function Tile({ id, label, options, value, onSelect }) {
  const ref = useRef(null);
  const { togglePicker } = useUI();

  const selected = options.find((o) => o.value === value);

  const open = () =>
    togglePicker({ anchor: ref.current, options, value, onSelect });

  return (
    <div
      className="tile"
      id={id}
      ref={ref}
      tabIndex={0}
      role="button"
      aria-haspopup="listbox"
      aria-label={`${label}: ${selected?.label ?? "none"}`}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
    >
      <span className="control-label">{label}</span>
      <span className="tile-value">{selected?.label ?? ""}</span>
    </div>
  );
}

/**
 * The Settings screen's version: one full-width box showing the chosen option,
 * opening the very same list. Same control, different shape - what used to be
 * inconsistent between the two screens was never the box, it was that one
 * opened this list and the other opened the platform's full-screen wheel.
 */
export function SettingsTile({ label, options, value, onSelect, id }) {
  const ref = useRef(null);
  const { togglePicker } = useUI();

  const selected = options.find((o) => o.value === value);

  const open = () =>
    togglePicker({ anchor: ref.current, options, value, onSelect });

  return (
    <div className="slider-container">
      <label className="control-label" htmlFor={id}>
        {label}
      </label>
      <div
        className="settings-tile"
        id={id}
        ref={ref}
        tabIndex={0}
        role="button"
        aria-haspopup="listbox"
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open();
          }
        }}
      >
        {selected?.label ?? ""}
      </div>
    </div>
  );
}
