import { useEffect, useRef } from "react";
import { usePlayer } from "../player/PlayerContext.jsx";

const VOLUME_STEP = 5;

/**
 * Keyboard and hardware media-key shortcuts.
 *
 * Space (or the media play/pause key) toggles the transport: if anything is
 * sounding it stops all of it, otherwise it starts the main one. The arrow keys
 * and +/- move the level of whatever is currently playing, which is nearly
 * always what is meant - adjusting the lehra's volume while only the tanpura is
 * droning would look broken.
 *
 * The pre-build version did this by finding buttons with getElementById and
 * calling .click() on them, and by writing values onto slider elements and
 * dispatching synthetic events. Here it calls the same functions the buttons
 * call, which is both shorter and immune to a renamed id.
 */
export function useKeyboardControls() {
  const player = usePlayer();

  // The handler is attached once; a ref keeps it looking at current state
  // without re-binding the listener on every render.
  const ref = useRef(player);
  ref.current = player;

  useEffect(() => {
    const onKeyDown = (e) => {
      const active = document.activeElement;
      const isTextInput =
        active &&
        ((active.tagName === "INPUT" &&
          ["text", "search", "number", "password", "email", ""].includes(
            active.type ?? ""
          )) ||
          active.tagName === "TEXTAREA" ||
          active.isContentEditable);
      const isRangeInput =
        active && active.tagName === "INPUT" && active.type === "range";

      const {
        playing,
        togglePrimary,
        toggleLehra,
        toggleTanpura,
        toggleMetronome,
        toggleTabla,
        volumes,
        setVolume,
        tablaMode
      } = ref.current;

      // --- Play / pause ---
      const isSpace =
        e.code === "Space" || e.key === " " || e.key === "Spacebar";
      const isMediaKey =
        ["MediaPlayPause", "MediaPlay", "MediaPause", "Play", "Pause", "MediaStop"].includes(e.key) ||
        ["MediaPlayPause", "MediaStop"].includes(e.code);

      if (isMediaKey || (isSpace && !isTextInput)) {
        e.preventDefault();

        const anyActive =
          playing.lehra || playing.tanpura || playing.tabla || playing.metronome;

        if (anyActive) {
          if (playing.lehra) toggleLehra();
          if (playing.tanpura) toggleTanpura();
          if (playing.tabla) toggleTabla();
          if (playing.metronome) toggleMetronome();
        } else {
          togglePrimary();
        }
        return;
      }

      // --- Volume ---
      const isHardwareUp = e.key === "AudioVolumeUp" || e.key === "VolumeUp";
      const isHardwareDown =
        e.key === "AudioVolumeDown" || e.key === "VolumeDown";
      const canUseArrows = !isTextInput && !isRangeInput;

      const isUp =
        isHardwareUp || (canUseArrows && ["ArrowUp", "+", "="].includes(e.key));
      const isDown =
        isHardwareDown || (canUseArrows && ["ArrowDown", "-", "_"].includes(e.key));

      if (!isUp && !isDown) return;
      e.preventDefault();

      const buses = [];
      if (playing.lehra) buses.push("lehra");
      if (playing.tabla) buses.push("tabla");
      if (playing.metronome) buses.push("metronome");
      if (playing.tanpura) buses.push("tanpura");

      // Nothing playing: move whichever level the main button would start.
      if (buses.length === 0) buses.push(tablaMode ? "tabla" : "lehra");

      buses.forEach((bus) => {
        const current = volumes[bus];
        setVolume(
          bus,
          isUp
            ? Math.min(100, current + VOLUME_STEP)
            : Math.max(0, current - VOLUME_STEP)
        );
      });
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // OS-level media controls (the keyboard's own play key, headset buttons, the
  // lock screen on mobile).
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.setActionHandler("play", () => {
        if (!ref.current.playing.lehra) ref.current.togglePrimary();
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        if (ref.current.playing.lehra) ref.current.togglePrimary();
      });
    } catch (err) {
      console.warn("MediaSession action handlers setup warning:", err);
    }
  }, []);
}
