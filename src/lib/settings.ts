import { DEFAULT_AUDIO_SETTINGS } from "./types";
import type { AudioProcessingSettings, Resolution, Fps, VideoFormat } from "./types";

export interface AppSettings {
  audio: AudioProcessingSettings;
  defaultQuality: Resolution;
  defaultFps: Fps;
  defaultFormat: VideoFormat;
}

const STORAGE_KEY = "drax-studio:settings";

export const DEFAULT_SETTINGS: AppSettings = {
  audio: DEFAULT_AUDIO_SETTINGS,
  defaultQuality: "1080p",
  defaultFps: 30,
  defaultFormat: "webm",
};

export function loadSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed, audio: { ...DEFAULT_SETTINGS.audio, ...parsed.audio } };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
