/**
 * Pure WSOLA time-stretch for the tanpura drone.
 *
 * Shared between the main thread (audio.js, used only as a fallback where Web
 * Workers are unavailable) and tanpura-worker.js (the normal path, so stretching
 * never blocks the audio scheduler or the UI). Operates on plain Float32Array
 * channel data - no AudioBuffer/AudioContext dependency - so it also runs
 * unchanged inside a Worker.
 *
 * See audio.js for why WSOLA (not playbackRate) and why the correlation search
 * exists: naive overlap-add lets consecutive grains land out of phase and
 * partially cancel, dropping level to ~1/sqrt(2) and audibly pumping.
 */
function stretchChannelsWSOLA(channelsData, sampleRate, factor) {
  const grainSize = Math.floor(sampleRate * 0.15);        // 150ms grains
  const outHop = Math.floor(grainSize / 2);               // 50% overlap
  const inHop = Math.max(1, Math.floor(outHop / factor));
  const srcLength = channelsData[0].length;
  const outLength = Math.max(grainSize + 1, Math.floor(srcLength * factor));
  const channels = channelsData.length;

  const win = new Float32Array(grainSize);
  for (let i = 0; i < grainSize; i++) {
    win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (grainSize - 1));
  }

  const SEARCH = Math.max(1, Math.min(750, inHop - 1));
  const CORR = 400;
  const COARSE = 6;

  const dsts = [];
  for (let c = 0; c < channels; c++) dsts.push(new Float32Array(outLength));

  const ref = channelsData[0];
  const refOut = dsts[0];

  let outPos = 0;
  let inPos = 0;

  while (outPos + grainSize < outLength && inPos + grainSize < srcLength) {
    let offset = 0;

    if (outPos > 0) {
      let best = -Infinity;
      const scan = (lo, hi, step) => {
        for (let d = lo; d <= hi; d += step) {
          const p = inPos + d;
          if (p < 0 || p + CORR >= srcLength) continue;
          let dot = 0;
          for (let i = 0; i < CORR; i++) dot += refOut[outPos + i] * ref[p + i];
          if (dot > best) { best = dot; offset = d; }
        }
      };
      scan(-SEARCH, SEARCH, COARSE);
      const coarse = offset;
      scan(Math.max(-SEARCH, coarse - COARSE), Math.min(SEARCH, coarse + COARSE), 1);
    }

    const readPos = Math.max(0, Math.min(inPos + offset, srcLength - grainSize - 1));
    for (let c = 0; c < channels; c++) {
      const s = channelsData[c];
      const d = dsts[c];
      for (let i = 0; i < grainSize; i++) d[outPos + i] += s[readPos + i] * win[i];
    }

    outPos += outHop;
    inPos += inHop;
  }

  return dsts;
}

// Available to Node test scripts; harmless no-op in browsers/Workers.
if (typeof module !== "undefined") module.exports = { stretchChannelsWSOLA };
