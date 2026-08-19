import { useLayoutEffect, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useUI } from "../ui/UIContext.jsx";

/**
 * The anchored option list behind every tile in the app.
 *
 * Left to the platform, tapping a <select> opens a picker that claims the whole
 * screen. This pops a small panel right off the tile that was tapped, sized to
 * its own options rather than to the viewport, and closes on a tap anywhere
 * else.
 *
 * Rendered once, at the app root, into a portal on <body> - the panel is
 * positioned in viewport coordinates and any `overflow: hidden` or
 * `backdrop-filter` between it and the root would clip it.
 */

// Five options at a time; the rest is a scroll.
//
// This is what keeps the panel on screen. Raag is sixteen options on Teentaal,
// and at full height that ran off the bottom from a tile in the middle of the
// card. Capping the list beats flipping the panel above the tile: a picker that
// sometimes opens upward and sometimes downward is harder to aim at than one
// that always does the same thing, and five rows is enough to show that the
// list continues.
const VISIBLE = 5;
const GAP = 6; // between the tile and the panel
const MARGIN = 8; // smallest gap left against the viewport edge

export function TilePicker() {
  const { picker, closePicker } = useUI();
  const panelRef = useRef(null);

  // Position and clamp once the options are in the DOM, so the row height can
  // be measured off a real row rather than assumed - it survives a change to
  // the option padding or the type size.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel || !picker?.anchor) return;

    const rect = picker.anchor.getBoundingClientRect();
    const width = Math.max(rect.width, 200);
    const left = Math.min(
      Math.max(rect.left, MARGIN),
      window.innerWidth - width - MARGIN
    );

    panel.style.width = `${width}px`;
    panel.style.left = `${Math.max(MARGIN, left)}px`;

    panel.style.maxHeight = "none";
    let wanted = panel.scrollHeight;

    if (panel.children.length > VISIBLE) {
      const cs = getComputedStyle(panel);
      const rowGap = parseFloat(cs.rowGap) || 0;
      const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const row = panel.children[0].getBoundingClientRect().height;
      wanted = VISIBLE * row + (VISIBLE - 1) * rowGap + pad;
    }

    // Downward, always. The clamp is a floor rather than a second placement
    // rule: on a handset short enough that five rows do not fit under the tile,
    // fewer show and the scroll covers the difference.
    const roomBelow = window.innerHeight - rect.bottom - GAP - MARGIN;
    panel.style.maxHeight = `${Math.max(96, Math.min(wanted, roomBelow))}px`;
    panel.style.top = `${rect.bottom + GAP}px`;
    panel.style.bottom = "auto";
  }, [picker]);

  // A tap anywhere outside closes it - including on a different tile, which
  // then opens its own picker right after. Capture phase, ahead of the tile's
  // own click handler, so that sequence lands as "close, then open the new one"
  // rather than "open, immediately closed".
  useEffect(() => {
    if (!picker) return;

    const onPointerDown = (e) => {
      if (panelRef.current?.contains(e.target)) return;
      // A tap on the tile the open picker belongs to is left to that tile's own
      // handler, which toggles it shut. Closing from here would have the click
      // that follows reopen it a moment later.
      if (picker.anchor?.contains(e.target)) return;
      closePicker();
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", onPointerDown, true);
  }, [picker, closePicker]);

  if (!picker) return null;

  return createPortal(
    <div className="tile-picker open" role="listbox" ref={panelRef}>
      {picker.options.map((opt) => (
        <div
          key={opt.value}
          className={
            "tile-picker-option" + (opt.value === picker.value ? " selected" : "")
          }
          role="option"
          aria-selected={opt.value === picker.value}
          onClick={() => {
            if (opt.value !== picker.value) picker.onSelect(opt.value);
            closePicker();
          }}
        >
          {opt.label}
        </div>
      ))}
    </div>,
    document.body
  );
}
