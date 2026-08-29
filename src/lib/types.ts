export type CaptureSource = "screen" | "window" | "tab" | "camera";
export type AudioMode = "mic" | "system" | "both" | "none";
export type Resolution = "720p" | "1080p" | "1440p" | "4k";
export type Fps = 24 | 30 | 60;
export type VideoFormat = "mp4" | "webm";

export const RESOLUTION_DIMENSIONS: Record<Resolution, { width: number; height: number }> = {
  "720p": { width: 1280, height: 720 },
  "1080p": { width: 1920, height: 1080 },
  "1440p": { width: 2560, height: 1440 },
  "4k": { width: 3840, height: 2160 },
};

export const RESOLUTION_LABELS: Record<Resolution, string> = {
  "720p": "720p",
  "1080p": "1080p Full HD",
  "1440p": "1440p QHD",
  "4k": "2160p / 4K",
};

export interface RecordingConfig {
  source: CaptureSource;
  quality: Resolution;
  fps: Fps;
  audioMode: AudioMode;
  includeCamera: boolean;
  orientation: "landscape" | "portrait";
}

export interface AudioProcessingSettings {
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
  voiceClarity: boolean;
  normalizeVolume: boolean;
  gain: number; // 0 - 2, 1 = unity
}

export const DEFAULT_AUDIO_SETTINGS: AudioProcessingSettings = {
  noiseSuppression: true,
  echoCancellation: true,
  autoGainControl: true,
  voiceClarity: true,
  normalizeVolume: true,
  gain: 1,
};

export type VideoStatus = "ready" | "processing" | "draft" | "error";

export interface VideoAsset {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  durationSec: number;
  width: number;
  height: number;
  sizeBytes: number;
  mimeType: string;
  status: VideoStatus;
  source: "recording" | "import" | "export";
  thumbnailBlob?: Blob;
}

export interface VideoBlobRecord {
  id: string;
  blob: Blob;
}

export type OverlayKind = "text" | "image" | "shape";

export interface TextOverlay {
  id: string;
  kind: "text";
  text: string;
  start: number;
  end: number;
  x: number; // 0-1 relative
  y: number; // 0-1 relative
  color: string;
  fontSize: number;
  isCaption?: boolean;
}

export interface ShapeOverlay {
  id: string;
  kind: "shape";
  shape: "rectangle" | "circle";
  start: number;
  end: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface ImageOverlay {
  id: string;
  kind: "image";
  imageDataUrl: string;
  start: number;
  end: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Overlay = TextOverlay | ShapeOverlay | ImageOverlay;

export type FilterPreset = "none" | "vivid" | "grayscale" | "warm" | "cool" | "cinematic";

export interface ClipSegment {
  id: string;
  sourceAssetId: string;
  inPoint: number; // seconds within source
  outPoint: number; // seconds within source
  speed: number; // 0.25 - 4
  volume: number; // 0 - 2
  muted: boolean;
  filter: FilterPreset;
  rotation: 0 | 90 | 180 | 270;
  transitionOut?: "none" | "fade";
}

export interface EditorProject {
  id: string;
  name: string;
  clips: ClipSegment[];
  overlays: Overlay[];
  musicTrack?: { assetId: string; volume: number } | null;
  replacedAudioAssetId?: string | null;
  createdAt: number;
  updatedAt: number;
}
