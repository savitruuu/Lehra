import { useEffect, useRef } from "react";

/**
 * Asked when Back is pressed on the player with nothing else to dismiss.
 *
 * The player is the bottom of the app, so Back there means "leave" - and
 * leaving mid-riyaaz because a thumb landed on the wrong edge of the screen is
 * exactly the mistake worth one tap to prevent. Press Back again instead of
 * answering and the app takes that as the answer: two presses means out.
 *
 * Styled from the same tokens as the sheets rather than a browser confirm():
 * a native dialog steals focus from the transport and, on some browsers, stalls
 * the audio thread behind it.
 */
export function ExitPrompt({ open, onStay, onExit }) {
  const stayRef = useRef(null);

  // Focus the safe choice, so Enter or Space dismisses rather than exits.
  useEffect(() => {
    if (open) stayRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onStay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onStay]);

  if (!open) return null;

  return (
    <div
      className="exit-prompt-scrim"
      onClick={onStay}
      role="presentation"
    >
      <div
        className="exit-prompt"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="exit-prompt-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h4 id="exit-prompt-title">Leave Lehra?</h4>
        <p>Anything playing will stop. Your practice log is already saved.</p>
        <div className="exit-prompt-actions">
          <button ref={stayRef} className="btn" type="button" onClick={onStay}>
            Keep practising
          </button>
          <button className="btn btn-primary" type="button" onClick={onExit}>
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}
