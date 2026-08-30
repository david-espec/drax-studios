"use client";

import { useCallback, useRef, useState } from "react";
import { acquireRecordingStreams, pickMimeType, type CapabilityWarning } from "@/lib/recorder";
import {
  NativeScreenRecorder,
  isNativeAndroid,
  nativeFileToBlob,
  type NativeRecordingStateEvent,
} from "@/lib/native-recorder";
import type { PluginListenerHandle } from "@capacitor/core";
import type { RecordingConfig, AudioProcessingSettings } from "@/lib/types";

export type RecorderPhase = "idle" | "requesting" | "recording" | "paused" | "stopped" | "error";

export function useScreenRecorder() {
  const [phase, setPhase] = useState<RecorderPhase>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [warnings, setWarnings] = useState<CapabilityWarning[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamsRef = useRef<{ combinedStream: MediaStream; displayStream: MediaStream | null; micStream: MediaStream | null; audioContext: AudioContext | null } | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const pausedAccumRef = useRef(0);
  const isNativeRef = useRef(false);
  const nativeListenerRef = useRef<PluginListenerHandle | null>(null);

  const stopLevelMeter = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const startLevelMeter = useCallback((audioContext: AudioContext, stream: MediaStream) => {
    if (stream.getAudioTracks().length === 0) return;
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    const source = audioContext.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
    source.connect(analyser);
    analyserRef.current = analyser;
    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      setAudioLevel(Math.min(1, avg / 128));
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    pausedAccumRef.current = 0;
    timerRef.current = window.setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 200);
  }, []);

  const cleanupStreams = useCallback(() => {
    const s = streamsRef.current;
    if (s) {
      s.combinedStream.getTracks().forEach((t) => t.stop());
      s.displayStream?.getTracks().forEach((t) => t.stop());
      s.micStream?.getTracks().forEach((t) => t.stop());
      s.audioContext?.close().catch(() => {});
    }
    streamsRef.current = null;
    stopLevelMeter();
  }, [stopLevelMeter]);

  const cleanupNativeListener = useCallback(() => {
    nativeListenerRef.current?.remove();
    nativeListenerRef.current = null;
  }, []);

  const handleNativeEvent = useCallback(
    (event: NativeRecordingStateEvent) => {
      if (event.state === "stopped") {
        stopTimer();
        cleanupNativeListener();
        if (event.filePath) {
          nativeFileToBlob(event.filePath)
            .then((blob) => {
              setResultBlob(blob);
              setPhase("stopped");
            })
            .catch((err) => {
              setErrorMessage(err instanceof Error ? err.message : "Falha ao ler o vídeo gravado.");
              setPhase("error");
            });
        } else {
          setPhase("stopped");
        }
      } else if (event.state === "error") {
        stopTimer();
        cleanupNativeListener();
        setErrorMessage(event.message ?? "Erro na gravação de tela.");
        setPhase("error");
      } else if (event.state === "paused") {
        setPhase("paused");
      } else if (event.state === "recording") {
        setPhase("recording");
      }
    },
    [stopTimer, cleanupNativeListener]
  );

  const startNative = useCallback(
    async (config: RecordingConfig) => {
      const overlay = await NativeScreenRecorder.hasOverlayPermission();
      let granted = overlay.granted;
      if (!granted) {
        const requested = await NativeScreenRecorder.requestOverlayPermission();
        granted = requested.granted;
      }
      if (!granted) {
        setErrorMessage(
          "Permissão para sobrepor outros aplicativos não concedida. Sem ela não é possível mostrar o painel flutuante, então a gravação não foi iniciada."
        );
        setPhase("error");
        return;
      }

      nativeListenerRef.current = await NativeScreenRecorder.addListener("recordingStateChanged", handleNativeEvent);
      await NativeScreenRecorder.startRecording({ audio: config.audioMode !== "none" });
      startTimer();
      setPhase("recording");
    },
    [handleNativeEvent, startTimer]
  );

  const start = useCallback(
    async (config: RecordingConfig, audioSettings: AudioProcessingSettings) => {
      setErrorMessage(null);
      setPhase("requesting");

      const useNative = config.source !== "camera" && isNativeAndroid();
      isNativeRef.current = useNative;

      if (useNative) {
        try {
          await startNative(config);
        } catch (err) {
          cleanupNativeListener();
          setErrorMessage(err instanceof Error ? err.message : "Não foi possível iniciar a gravação.");
          setPhase("error");
        }
        return;
      }

      try {
        const streams = await acquireRecordingStreams(config, audioSettings);
        streamsRef.current = streams;
        setWarnings(streams.warnings);

        if (streams.audioContext) {
          startLevelMeter(streams.audioContext, streams.combinedStream);
        }

        const { mimeType } = pickMimeType();
        chunksRef.current = [];
        const recorder = new MediaRecorder(streams.combinedStream, {
          mimeType,
          videoBitsPerSecond: 12_000_000,
        });
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          setResultBlob(blob);
          setPhase("stopped");
          cleanupStreams();
          stopTimer();
        };

        // If the user stops sharing from the browser's native UI, end the recording gracefully.
        streams.displayStream?.getVideoTracks()[0]?.addEventListener("ended", () => {
          if (recorderRef.current && recorderRef.current.state !== "inactive") {
            recorderRef.current.stop();
          }
        });

        recorder.start(1000);
        recorderRef.current = recorder;
        startTimer();
        setPhase("recording");
      } catch (err) {
        cleanupStreams();
        setErrorMessage(err instanceof Error ? err.message : "Não foi possível iniciar a gravação.");
        setPhase("error");
      }
    },
    [cleanupStreams, cleanupNativeListener, startLevelMeter, startNative, startTimer, stopTimer]
  );

  const pause = useCallback(() => {
    if (isNativeRef.current) {
      NativeScreenRecorder.pauseRecording().catch(() => {});
      stopTimer();
      pausedAccumRef.current += Date.now() - startTimeRef.current;
      setPhase("paused");
      return;
    }
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.pause();
      stopTimer();
      pausedAccumRef.current += Date.now() - startTimeRef.current;
      setPhase("paused");
    }
  }, [stopTimer]);

  const resume = useCallback(() => {
    if (isNativeRef.current) {
      NativeScreenRecorder.resumeRecording().catch(() => {});
      startTimeRef.current = Date.now() - pausedAccumRef.current;
      timerRef.current = window.setInterval(() => {
        setElapsedMs(Date.now() - startTimeRef.current);
      }, 200);
      setPhase("recording");
      return;
    }
    if (recorderRef.current?.state === "paused") {
      recorderRef.current.resume();
      startTimeRef.current = Date.now() - pausedAccumRef.current;
      timerRef.current = window.setInterval(() => {
        setElapsedMs(Date.now() - startTimeRef.current);
      }, 200);
      setPhase("recording");
    }
  }, []);

  const finish = useCallback(() => {
    if (isNativeRef.current) {
      // The stopped state (and resulting blob) arrives via the recordingStateChanged
      // event, which also fires if the user stops from the floating bubble instead.
      NativeScreenRecorder.stopRecording().catch(() => {});
      return;
    }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  }, []);

  const reset = useCallback(() => {
    isNativeRef.current = false;
    cleanupNativeListener();
    setPhase("idle");
    setElapsedMs(0);
    setAudioLevel(0);
    setResultBlob(null);
    setWarnings([]);
    setErrorMessage(null);
    chunksRef.current = [];
  }, [cleanupNativeListener]);

  return { phase, elapsedMs, audioLevel, warnings, errorMessage, resultBlob, start, pause, resume, finish, reset };
}
