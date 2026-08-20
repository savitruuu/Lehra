import { usePlayer, vibhaagSign } from "../player/PlayerContext.jsx";
import { AvartanChakra } from "./AvartanChakra.jsx";

/**
 * Takes over the screen after thirty seconds of undisturbed playing.
 *
 * The single-screen player has no room for the avartan chakra, so this is where
 * it lives - which turns out to be the right home for it anyway: with every
 * control out of sight, the ring, the matra and the two readouts are exactly
 * what a player still wants in front of them.
 *
 * Tap anywhere to come back. The Reset button is the one exception, exempted
 * from the dismiss-on-touch in App so it can actually be pressed.
 */
export function Screensaver() {
  const {
    screensaverOn,
    avartanCount,
    resetSessionClock,
    bpm,
    practiceSeconds,
    beat,
    samPulse,
    taalDef
  } = usePlayer();

  const mins = Math.floor(practiceSeconds / 60);
  const secs = practiceSeconds % 60;

  // The vibhaag markers: one sign per clap group, the current one lit.
  const marks = [];
  let matra = 1;
  taalDef.vibhaags.forEach((length, index) => {
    const sign = vibhaagSign(taalDef, matra);
    marks.push({ sign, index, matra });
    matra += length;
  });

  return (
    <div className={"screensaver" + (screensaverOn ? " active" : "")}>
      {/* How many cycles have turned since the transport started. Outside the
          ring rather than in it - the centre already holds the matra, the bol
          and the two readouts, and this is a running total rather than part of
          the pulse. */}
      <div className="screensaver-avartan">
        <span className="screensaver-avartan-label">Avartan</span>
        <span className="screensaver-avartan-count">{avartanCount}</span>
      </div>

      {/* Sets the session clock back to 0:00 without stopping anything. */}
      <button
        className="screensaver-reset-btn"
        id="screensaver-reset"
        type="button"
        onClick={resetSessionClock}
      >
        Reset timer
      </button>

      <div className="glass-panel visual-tracker-container">
        <div className={"sam-glow-indicator" + (samPulse ? " active" : "")} />
        <AvartanChakra active={screensaverOn} />
        <div className="beat-display">
          {/* Tempo and session length, shown only while the screensaver holds
              the screen: with every other control out of sight, these are the
              two readings a player still wants. */}
          <div className="screensaver-readout screensaver-tempo">{bpm} BPM</div>
          <div className="beat-number">{beat.matraNumber}</div>
          {/* Only the tabla bol - Sam, tali and khali are already carried by
              the vibhaag markers below. A non-breaking space when a taal has no
              theka, so an absent bol cannot collapse the row. */}
          <div className="beat-name" title={beat.bol}>
            {beat.bol || " "}
          </div>
          <div className="vibhaag-markers">
            {marks.map((mark) => (
              <div
                key={mark.index}
                className={
                  "vibhaag-mark" +
                  (mark.sign === "X" ? " sam" : "") +
                  (mark.sign === "0" ? " khali" : "") +
                  (mark.index === beat.vibhaag ? " active" : "")
                }
                title={`Matra ${mark.matra}`}
              >
                {mark.sign}
              </div>
            ))}
          </div>
          <div className="screensaver-readout screensaver-time">
            {mins}:{String(secs).padStart(2, "0")}
          </div>
        </div>
      </div>
    </div>
  );
}
