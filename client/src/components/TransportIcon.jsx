const PLAY_PATH = "M8 5v14l11-7z";
const PAUSE_PATH = "M6 19h4V5H6v14zm8-14v14h4V5h-4z";

/** The one play/pause glyph, shared by the main transport and all three mixer buttons. */
export function TransportIcon({ playing }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={playing ? PAUSE_PATH : PLAY_PATH} />
    </svg>
  );
}
