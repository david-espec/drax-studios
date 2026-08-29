"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getVideo } from "@/lib/db";
import type { ClipSegment } from "@/lib/types";

export interface ClipRange {
  clip: ClipSegment;
  clipIndex: number;
  globalStart: number;
  globalEnd: number;
}

export function buildClipRanges(clips: ClipSegment[]): ClipRange[] {
  let cursor = 0;
  return clips.map((clip, clipIndex) => {
    const duration = (clip.outPoint - clip.inPoint) / clip.speed;
    const range: ClipRange = { clip, clipIndex, globalStart: cursor, globalEnd: cursor + duration };
    cursor += duration;
    return range;
  });
}

export function findClipAtTime(ranges: ClipRange[], t: number): ClipRange | null {
  if (ranges.length === 0) return null;
  const clamped = Math.max(0, t);
  for (const r of ranges) {
    if (clamped >= r.globalStart && clamped < r.globalEnd) return r;
  }
  return ranges[ranges.length - 1];
}

export function useTimelinePlayer(clips: ClipSegment[]) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playhead, setPlayhead] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const urlCacheRef = useRef<Map<string, string>>(new Map());
  const rafRef = useRef<number | null>(null);
  const pendingSeekRef = useRef<number | null>(null);

  const ranges = buildClipRanges(clips);
  const totalDuration = ranges.length > 0 ? ranges[ranges.length - 1].globalEnd : 0;

  const getObjectUrl = useCallback(async (assetId: string) => {
    const cached = urlCacheRef.current.get(assetId);
    if (cached) return cached;
    const asset = await getVideo(assetId);
    if (!asset) return null;
    const url = URL.createObjectURL(asset.blob);
    urlCacheRef.current.set(assetId, url);
    return url;
  }, []);

  useEffect(() => {
    const cache = urlCacheRef.current;
    return () => {
      cache.forEach((url) => URL.revokeObjectURL(url));
      cache.clear();
    };
  }, []);

  const seek = useCallback(
    async (t: number) => {
      const clamped = Math.min(Math.max(0, t), totalDuration || 0);
      const range = findClipAtTime(ranges, clamped);
      if (!range) return;
      const video = videoRef.current;
      const url = await getObjectUrl(range.clip.sourceAssetId);
      if (!video || !url) return;

      const localSourceTime = range.clip.inPoint + (clamped - range.globalStart) * range.clip.speed;

      if (activeClipId !== range.clip.id || video.src !== url) {
        pendingSeekRef.current = localSourceTime;
        if (video.src !== url) video.src = url;
        video.playbackRate = range.clip.speed;
        video.volume = range.clip.muted ? 0 : Math.min(1, range.clip.volume);
        video.style.filter = cssFilterFor(range.clip.filter);
        video.style.transform = rotationTransform(range.clip.rotation);
        setActiveClipId(range.clip.id);
        video.currentTime = localSourceTime;
      } else {
        video.currentTime = localSourceTime;
      }
      setPlayhead(clamped);
    },
    [ranges, totalDuration, getObjectUrl, activeClipId]
  );

  useEffect(() => {
    if (clips.length > 0 && activeClipId === null) {
      seek(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clips.length]);

  const play = useCallback(() => {
    videoRef.current?.play();
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    videoRef.current?.pause();
    setIsPlaying(false);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onLoadedMeta = () => {
      if (pendingSeekRef.current !== null) {
        video.currentTime = pendingSeekRef.current;
        pendingSeekRef.current = null;
      }
      if (isPlaying) video.play().catch(() => {});
    };
    video.addEventListener("loadedmetadata", onLoadedMeta);
    return () => video.removeEventListener("loadedmetadata", onLoadedMeta);
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    const tick = () => {
      const video = videoRef.current;
      const range = ranges.find((r) => r.clip.id === activeClipId);
      if (video && range) {
        const localTime = video.currentTime;
        const global = range.globalStart + (localTime - range.clip.inPoint) / range.clip.speed;

        if (localTime >= range.clip.outPoint - 0.03) {
          const nextRange = ranges[range.clipIndex + 1];
          if (nextRange) {
            seek(nextRange.globalStart + 0.001).then(() => {
              videoRef.current?.play().catch(() => {});
            });
          } else {
            pause();
            setPlayhead(totalDuration);
          }
        } else {
          setPlayhead(Math.max(0, global));
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, activeClipId, ranges]);

  return { videoRef, playhead, isPlaying, play, pause, seek, totalDuration, ranges, activeClipId };
}

export function cssFilterFor(preset: ClipSegment["filter"]): string {
  switch (preset) {
    case "none":
      return "none";
    case "vivid":
      return "saturate(1.6) contrast(1.15)";
    case "grayscale":
      return "grayscale(1)";
    case "warm":
      return "sepia(0.25) saturate(1.2) hue-rotate(-8deg)";
    case "cool":
      return "saturate(1.1) hue-rotate(8deg) brightness(0.98)";
    case "cinematic":
      return "contrast(1.15) saturate(0.8) brightness(0.97)";
  }
}

export function rotationTransform(rotation: ClipSegment["rotation"]): string {
  return rotation === 0 ? "none" : `rotate(${rotation}deg)`;
}
