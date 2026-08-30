import type { AudioMode, CaptureSource, RecordingConfig } from "./types";
import { RESOLUTION_DIMENSIONS } from "./types";
import type { AudioProcessingSettings } from "./types";

export interface CapabilityWarning {
  message: string;
}

function pickMimeType(): { mimeType: string; ext: string } {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
      return { mimeType: type, ext: type.startsWith("video/mp4") ? "mp4" : "webm" };
    }
  }
  return { mimeType: "video/webm", ext: "webm" };
}

function buildAudioConstraints(settings: AudioProcessingSettings): MediaTrackConstraints {
  return {
    echoCancellation: settings.echoCancellation,
    noiseSuppression: settings.noiseSuppression,
    autoGainControl: settings.autoGainControl,
    channelCount: 2,
  };
}

/** Builds a processed audio track applying gain + optional voice-clarity/normalization via WebAudio. */
function processAudioTrack(
  stream: MediaStream,
  settings: AudioProcessingSettings
): { track: MediaStreamTrack | null; audioContext: AudioContext | null } {
  if (stream.getAudioTracks().length === 0) return { track: null, audioContext: null };

  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioContext = new AudioCtx();
  const source = audioContext.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));

  let node: AudioNode = source;

  if (settings.voiceClarity) {
    const highpass = audioContext.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 80;
    node.connect(highpass);
    node = highpass;

    const presence = audioContext.createBiquadFilter();
    presence.type = "peaking";
    presence.frequency.value = 3000;
    presence.gain.value = 4;
    presence.Q.value = 1;
    node.connect(presence);
    node = presence;
  }

  const gainNode = audioContext.createGain();
  gainNode.gain.value = settings.gain;
  node.connect(gainNode);
  node = gainNode;

  let outputNode: AudioNode = node;

  if (settings.normalizeVolume) {
    const compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 30;
    compressor.ratio.value = 6;
    compressor.attack.value = 0.02;
    compressor.release.value = 0.25;
    node.connect(compressor);
    outputNode = compressor;
  }

  const destination = audioContext.createMediaStreamDestination();
  outputNode.connect(destination);

  return { track: destination.stream.getAudioTracks()[0] ?? null, audioContext };
}

export interface AcquiredStreams {
  combinedStream: MediaStream;
  displayStream: MediaStream | null;
  micStream: MediaStream | null;
  audioContext: AudioContext | null;
  warnings: CapabilityWarning[];
}

export async function acquireRecordingStreams(config: RecordingConfig, audioSettings: AudioProcessingSettings): Promise<AcquiredStreams> {
  const warnings: CapabilityWarning[] = [];
  const { width, height } = RESOLUTION_DIMENSIONS[config.quality];

  let displayStream: MediaStream | null = null;
  let micStream: MediaStream | null = null;

  if (config.source === "camera") {
    micStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: width },
        height: { ideal: height },
        frameRate: { ideal: config.fps },
        facingMode: "user",
      },
      audio: config.audioMode !== "none" ? buildAudioConstraints(audioSettings) : false,
    });
    displayStream = micStream;
  } else {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      throw new Error(
        "Gravação de tela não é compatível com este navegador ou dispositivo. Use a opção Câmera, ou acesse pelo computador para gravar a tela."
      );
    }
    const displayMediaOptions: DisplayMediaStreamOptions & { preferCurrentTab?: boolean } = {
      video: {
        width: { ideal: width },
        height: { ideal: height },
        frameRate: { ideal: config.fps },
      },
      audio: config.audioMode === "system" || config.audioMode === "both",
    };
    if (config.source === "tab") {
      displayMediaOptions.preferCurrentTab = true;
    }
    displayStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);

    const settings = displayStream.getVideoTracks()[0]?.getSettings();
    if (settings?.width && settings.width < width * 0.9) {
      warnings.push({
        message: `A fonte selecionada só forneceu ${settings.width}x${settings.height}. A qualidade ${config.quality} pode não ser totalmente suportada por este dispositivo/navegador.`,
      });
    }
    if (config.audioMode === "system" || config.audioMode === "both") {
      if (displayStream.getAudioTracks().length === 0) {
        warnings.push({
          message: "Este navegador ou fonte não permitiu capturar o áudio do sistema. Verifique se marcou 'Compartilhar áudio' na caixa de seleção.",
        });
      }
    }

    if (config.audioMode === "mic" || config.audioMode === "both") {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: buildAudioConstraints(audioSettings),
      });
    }

    if (config.includeCamera) {
      const camStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: "user" },
      });
      camStream.getVideoTracks().forEach((t) => displayStream!.addTrack(t));
    }
  }

  const rawAudioTracks = [
    ...(displayStream?.getAudioTracks() ?? []),
    ...(micStream && micStream !== displayStream ? micStream.getAudioTracks() : []),
  ];

  const combinedStream = new MediaStream();
  displayStream?.getVideoTracks().forEach((t) => combinedStream.addTrack(t));

  let audioContext: AudioContext | null = null;
  if (rawAudioTracks.length > 0 && config.audioMode !== "none") {
    const rawAudioStream = new MediaStream(rawAudioTracks);
    const { track, audioContext: ctx } = processAudioTrack(rawAudioStream, audioSettings);
    audioContext = ctx;
    if (track) combinedStream.addTrack(track);
  }

  return { combinedStream, displayStream, micStream, audioContext, warnings };
}

export { pickMimeType };

export function sourceLabel(source: CaptureSource): string {
  switch (source) {
    case "screen":
      return "Tela inteira";
    case "window":
      return "Janela específica";
    case "tab":
      return "Aba do navegador";
    case "camera":
      return "Câmera";
  }
}

export function audioModeLabel(mode: AudioMode): string {
  switch (mode) {
    case "mic":
      return "Microfone";
    case "system":
      return "Áudio do sistema";
    case "both":
      return "Microfone + sistema";
    case "none":
      return "Sem áudio";
  }
}
