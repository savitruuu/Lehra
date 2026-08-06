/**
 * Runs the tanpura's WSOLA time-stretch off the main thread.
 *
 * Without this, tempo changes computed the stretch inline inside the real-time
 * audio scheduler and froze both audio and UI for ~0.3-0.8s on every change.
 */
importScripts("tanpura-dsp.js");

self.onmessage = function (e) {
  const { id, channelsData, sampleRate, factor } = e.data;
  const result = stretchChannelsWSOLA(channelsData, sampleRate, factor);
  self.postMessage(
    { id, channelsData: result, length: result[0].length },
    result.map(c => c.buffer)
  );
};
