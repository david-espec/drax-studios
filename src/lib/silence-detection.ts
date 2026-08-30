export interface SilentRange {
  start: number;
  end: number;
}

export interface SilenceDetectionOptions {
  /** RMS threshold in dBFS below which a window is considered silent. */
  thresholdDb?: number;
  /** Minimum duration (seconds) a silent stretch must last to be suggested as a cut. */
  minSilenceDuration?: number;
  /** Seconds of speech-side padding kept around each cut so words aren't clipped. */
  paddingSec?: number;
}

const DEFAULTS: Required<SilenceDetectionOptions> = {
  thresholdDb: -50,
  minSilenceDuration: 0.6,
  paddingSec: 0.15,
};

/**
 * Detects silent stretches in an audio/video file's audio track by measuring
 * RMS energy over short windows. Returns ranges (in the file's own seconds)
 * long enough and quiet enough to be worth cutting.
 */
export async function detectSilentRanges(
  blob: Blob,
  options: SilenceDetectionOptions = {}
): Promise<SilentRange[]> {
  const { thresholdDb, minSilenceDuration, paddingSec } = { ...DEFAULTS, ...options };

  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioCtx();
  let audioBuffer: AudioBuffer;
  try {
    const arrayBuffer = await blob.arrayBuffer();
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  } catch {
    return [];
  } finally {
    await audioCtx.close().catch(() => {});
  }

  const sampleRate = audioBuffer.sampleRate;
  const channels: Float32Array[] = [];
  for (let c = 0; c < audioBuffer.numberOfChannels; c++) channels.push(audioBuffer.getChannelData(c));

  const windowSize = Math.max(1, Math.round(0.05 * sampleRate));
  const totalSamples = audioBuffer.length;
  const thresholdLinear = Math.pow(10, thresholdDb / 20);

  const isWindowSilent = (start: number, end: number) => {
    let sumSquares = 0;
    let count = 0;
    for (const data of channels) {
      for (let i = start; i < end; i++) {
        sumSquares += data[i] * data[i];
        count++;
      }
    }
    const rms = count > 0 ? Math.sqrt(sumSquares / count) : 0;
    return rms < thresholdLinear;
  };

  const ranges: SilentRange[] = [];
  let silentStartSample: number | null = null;

  for (let start = 0; start <= totalSamples; start += windowSize) {
    const end = Math.min(start + windowSize, totalSamples);
    const silent = start < totalSamples && isWindowSilent(start, end);

    if (silent && silentStartSample === null) {
      silentStartSample = start;
    } else if (!silent && silentStartSample !== null) {
      const startSec = silentStartSample / sampleRate;
      const endSec = start / sampleRate;
      if (endSec - startSec >= minSilenceDuration) {
        const paddedStart = startSec + paddingSec;
        const paddedEnd = endSec - paddingSec;
        if (paddedEnd > paddedStart) ranges.push({ start: paddedStart, end: paddedEnd });
      }
      silentStartSample = null;
    }
  }

  return ranges;
}
