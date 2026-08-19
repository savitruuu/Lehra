/**
 * Runs the tanpura's WSOLA time-stretch off the main thread.
 *
 * Without this, tempo changes computed the stretch inline inside the real-time
 * audio scheduler and froze both audio and UI for ~0.3-0.8s on every change.
 *
 * A module worker rather than the importScripts() one the pre-build app used:
 * Vite bundles it from the `new Worker(new URL(...), { type: "module" })` call
 * in audio.js, so the DSP below is the very same source the main-thread
 * fallback path imports rather than a second copy served off the document root.
 */
import { stretchChannelsWSOLA } from "./tanpuraDsp.js";

self.onmessage = function (e) {
  const { id, channelsData, sampleRate, factor } = e.data;
  const result = stretchChannelsWSOLA(channelsData, sampleRate, factor);
  self.postMessage(
    { id, channelsData: result, length: result[0].length },
    result.map((c) => c.buffer)
  );
};
