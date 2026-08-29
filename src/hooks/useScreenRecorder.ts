"use client";

import { useCallback, useRef, useState } from "react";
import { acquireRecordingStreams, pickMimeType, type CapabilityWarning } from "@/lib/recorder";
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

  const start = useCallback(
    async (config: RecordingConfig, audioSettings: AudioProcessingSettings) => {
      setErrorMessage(null);
      setPhase("requesting");
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
    [cleanupStreams, startLevelMeter, startTimer, stopTimer]
  );

  const pause = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.pause();
      stopTimer();
      pausedAccumRef.current += Date.now() - startTimeRef.current;
      setPhase("paused");
    }
  }, [stopTimer]);

  const resume = useCallback(() => {
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
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  }, []);

  const reset = useCallback(() => {
    setPhase("idle");
    setElapsedMs(0);
    setAudioLevel(0);
    setResultBlob(null);
    setWarnings([]);
    setErrorMessage(null);
    chunksRef.current = [];
  }, []);

  return { phase, elapsedMs, audioLevel, warnings, errorMessage, resultBlob, start, pause, resume, finish, reset };
}
