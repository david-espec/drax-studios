import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export interface NativeRecordingStateEvent {
  state: "recording" | "paused" | "stopped" | "error";
  message?: string;
  filePath?: string;
  durationMs?: number;
  width?: number;
  height?: number;
}

export interface NativeScreenRecorderPlugin {
  hasOverlayPermission(): Promise<{ granted: boolean }>;
  requestOverlayPermission(): Promise<{ granted: boolean }>;
  startRecording(options: { audio: boolean }): Promise<{ started: boolean }>;
  pauseRecording(): Promise<void>;
  resumeRecording(): Promise<void>;
  stopRecording(): Promise<{ filePath: string; durationMs: number; width: number; height: number }>;
  addListener(
    eventName: "recordingStateChanged",
    listenerFunc: (event: NativeRecordingStateEvent) => void
  ): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

export const NativeScreenRecorder = registerPlugin<NativeScreenRecorderPlugin>("ScreenRecorder");

/** True only inside the compiled Android app (the Capacitor WebView), never in a regular mobile browser tab. */
export function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

/** Reads a file the native plugin wrote to app storage back into a Blob, via Capacitor's WebView file bridge. */
export async function nativeFileToBlob(filePath: string): Promise<Blob> {
  const url = Capacitor.convertFileSrc(filePath);
  const response = await fetch(url);
  if (!response.ok) throw new Error("Não foi possível ler o arquivo de vídeo gravado.");
  return response.blob();
}
