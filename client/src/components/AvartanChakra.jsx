import { useEffect, useRef } from "react";
import { AudioEngine } from "../engine/audio.js";
import { TAAL_DATA } from "../engine/taalData.js";
import { getThemeColor } from "../lib/practiceLog.js";
import {
  usePlayer,
  vibhaagIndexForMatra,
  vibhaagStartMatra
} from "../player/PlayerContext.jsx";

/**
 * The cycle drawn as a ring: one dot per matra, Sam at twelve o'clock, and an
 * arc that fills as the avartan turns.
 *
 * This replaced an analyser waveform wrapped around the same circle. A waveform
 * carries amplitude, which is the one thing a taal tracker does not need - it
 * read identically at matra 3 and matra 14, so the number underneath was doing
 * all the work, and a number has to be read rather than glanced at. The ring
 * puts position in the cycle and distance to Sam into the shape itself.
 *
 * Driven by the matra clock rather than the analyser, which also means it keeps
 * tracking with the lehra paused - practising tabla against the theka alone
 * used to leave a still circle.
 *
 * The centre stays in the DOM (.beat-display, rendered by the caller): the
 * matra number, the bol and the vibhaag markers are already styled, themed and
 * responsive there, and canvas text would only duplicate them worse.
 *
 * Everything below reads refs and the engine directly rather than React state.
 * At 60fps a state-driven redraw would re-render the whole player tree sixty
 * times a second to move one arc.
 */
export function AvartanChakra({ active }) {
  const canvasRef = useRef(null);
  const { avartanPosition } = usePlayer();
  const positionRef = useRef(avartanPosition);
  positionRef.current = avartanPosition;

  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    // setTransform rather than scale: scale compounds every time it is applied
    // to the same context, so resizing repeatedly used to shrink the drawing.
    // Assigning canvas.width also clears the bitmap, so only ever do it when
    // the size has genuinely changed - this runs on every frame.
    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = Math.round(rect.width * dpr);
      const h = Math.round(rect.height * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    // getComputedStyle is not free and the ring needs six colours a frame, so
    // the palette is read once and kept until the theme actually changes.
    let palette = null;
    let paletteKey = null;
    const readPalette = () => {
      const key = document.body.className;
      if (palette && paletteKey === key) return palette;
      paletteKey = key;
      palette = {
        line: getThemeColor("--panel-border") || "rgba(255,255,255,0.08)",
        mint: getThemeColor("--accent-cyan") || "#89d7b7",
        gold: getThemeColor("--accent-gold") || "#fbbf24",
        muted: getThemeColor("--text-muted") || "#5a8a7a",
        mintGlow: getThemeColor("--accent-cyan-glow") || "#89d7b7",
        goldGlow: getThemeColor("--accent-gold-glow") || "#fbbf24"
      };
      return palette;
    };

    let frame = null;

    const draw = () => {
      frame = requestAnimationFrame(draw);

      // The tracker sits inside the screensaver, which is laid out even while
      // invisible - so without this the ring would be redrawn every frame at
      // nobody.
      if (!activeRef.current) return;

      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      if (!width || !height) return;

      resizeCanvas();
      ctx.clearRect(0, 0, width, height);

      const taal = TAAL_DATA[AudioEngine.activeTaalKey];
      if (!taal) return;

      const centerX = width / 2;
      const centerY = height / 2;

      // The ring has the whole screen to itself here and the readout in the
      // middle needs the room, so it is drawn out to the edge - backing off
      // only far enough to clear the glow around the current matra dot, which
      // is painted outside the ring and would otherwise clip against the edge.
      const half = Math.min(centerX, centerY);
      const radius = Math.max(half * 0.75, half - 26);
      const TOP = -Math.PI / 2;

      const position = positionRef.current();
      const currentIndex = Math.floor(position) % taal.matras;

      const { line, mint, gold, muted, mintGlow, goldGlow } = readPalette();

      // Vibhaag arcs, broken by a small gap so the clap groups read as groups.
      // The khali vibhaag is drawn thinner - the same "deliberately dimmer"
      // treatment its marker below already uses.
      let matra = 1;
      taal.vibhaags.forEach((vibhaagLength) => {
        const isKhali = taal.khali_positions.includes(matra);
        const a0 = TOP + ((matra - 1) / taal.matras) * Math.PI * 2 + 0.045;
        const a1 =
          TOP + ((matra - 1 + vibhaagLength) / taal.matras) * Math.PI * 2 - 0.045;

        ctx.strokeStyle = line;
        ctx.lineWidth = isKhali ? 1 : 2.5;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, a0, a1);
        ctx.stroke();

        matra += vibhaagLength;
      });

      // How far round the ring the avartan has come.
      ctx.strokeStyle = mint;
      ctx.lineWidth = 3.5;
      ctx.lineCap = "round";
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.arc(
        centerX,
        centerY,
        radius,
        TOP,
        TOP + (position / taal.matras) * Math.PI * 2
      );
      ctx.stroke();
      ctx.globalAlpha = 1;

      // One dot per matra.
      for (let i = 0; i < taal.matras; i++) {
        const angle = TOP + (i / taal.matras) * Math.PI * 2;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);

        const isSam = i === 0;
        const isCurrent = i === currentIndex;
        const hasPassed = i < currentIndex;
        const inKhali = taal.khali_positions.includes(
          vibhaagStartMatra(taal, vibhaagIndexForMatra(taal, i + 1))
        );

        ctx.beginPath();
        ctx.arc(x, y, isCurrent ? 8.5 : isSam ? 6 : 4.5, 0, Math.PI * 2);

        if (isCurrent) {
          ctx.fillStyle = isSam ? gold : mint;
          ctx.shadowColor = isSam ? goldGlow : mintGlow;
          ctx.shadowBlur = 16;
          ctx.fill();
          ctx.shadowBlur = 0;
        } else if (inKhali) {
          // Khali matras stay hollow whether or not they have gone by, so the
          // empty vibhaag is visible as emptiness.
          ctx.strokeStyle = hasPassed ? mint : muted;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else if (hasPassed) {
          ctx.fillStyle = mint;
          ctx.globalAlpha = 0.35;
          ctx.fill();
          ctx.globalAlpha = 1;
        } else {
          ctx.fillStyle = isSam ? gold : muted;
          ctx.globalAlpha = isSam ? 0.85 : 0.4;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    draw();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, []);

  return <canvas className="canvas-visualizer" ref={canvasRef} />;
}
