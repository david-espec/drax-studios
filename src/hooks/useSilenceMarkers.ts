"use client";

import { useCallback, useMemo, useState } from "react";
import { getVideo } from "@/lib/db";
import { detectSilentRanges } from "@/lib/silence-detection";
import type { ClipRange } from "./useTimelinePlayer";

interface PendingSilence {
  id: string;
  sourceAssetId: string;
  localStart: number;
  localEnd: number;
}

export interface DisplaySilenceMarker {
  id: string;
  globalStart: number;
  globalEnd: number;
}

function findCurrentRange(ranges: ClipRange[], sourceAssetId: string, localStart: number, localEnd: number) {
  return ranges.find(
    (r) =>
      r.clip.sourceAssetId === sourceAssetId &&
      r.clip.inPoint <= localStart + 1e-6 &&
      r.clip.outPoint >= localEnd - 1e-6
  );
}

export function useSilenceMarkers(
  ranges: ClipRange[],
  applyCutRanges: (cutsByClipId: Record<string, { start: number; end: number }[]>) => void
) {
  const [pending, setPending] = useState<PendingSilence[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [hasMostlySilentAsset, setHasMostlySilentAsset] = useState(false);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);

  const markers: DisplaySilenceMarker[] = useMemo(() => {
    const result: DisplaySilenceMarker[] = [];
    for (const p of pending) {
      const r = findCurrentRange(ranges, p.sourceAssetId, p.localStart, p.localEnd);
      if (!r) continue;
      const globalStart = r.globalStart + (p.localStart - r.clip.inPoint) / r.clip.speed;
      const globalEnd = r.globalStart + (p.localEnd - r.clip.inPoint) / r.clip.speed;
      result.push({ id: p.id, globalStart, globalEnd });
    }
    return result;
  }, [pending, ranges]);

  const analyze = useCallback(async () => {
    setAnalyzing(true);
    setHasMostlySilentAsset(false);
    try {
      const uniqueAssetIds = [...new Set(ranges.map((r) => r.clip.sourceAssetId))];
      const found: PendingSilence[] = [];
      let anyMostlySilent = false;

      for (const assetId of uniqueAssetIds) {
        const asset = await getVideo(assetId);
        if (!asset) continue;
        const { ranges: silentRanges, mostlySilent } = await detectSilentRanges(asset.blob);
        if (mostlySilent) anyMostlySilent = true;

        for (const r of ranges) {
          if (r.clip.sourceAssetId !== assetId) continue;
          for (const silent of silentRanges) {
            const localStart = Math.max(r.clip.inPoint, silent.start);
            const localEnd = Math.min(r.clip.outPoint, silent.end);
            if (localEnd <= localStart) continue;
            found.push({ id: crypto.randomUUID(), sourceAssetId: assetId, localStart, localEnd });
          }
        }
      }

      setPending(found);
      setHasMostlySilentAsset(anyMostlySilent);
      setSelectedMarkerId(null);
    } finally {
      setAnalyzing(false);
    }
  }, [ranges]);

  const removeMarker = useCallback(
    (id: string) => {
      const p = pending.find((x) => x.id === id);
      if (p) {
        const r = findCurrentRange(ranges, p.sourceAssetId, p.localStart, p.localEnd);
        if (r) applyCutRanges({ [r.clip.id]: [{ start: p.localStart, end: p.localEnd }] });
      }
      setPending((list) => list.filter((x) => x.id !== id));
      setSelectedMarkerId((cur) => (cur === id ? null : cur));
    },
    [pending, ranges, applyCutRanges]
  );

  const dismissMarker = useCallback((id: string) => {
    setPending((list) => list.filter((x) => x.id !== id));
    setSelectedMarkerId((cur) => (cur === id ? null : cur));
  }, []);

  const removeAll = useCallback(() => {
    const cutsByClipId: Record<string, { start: number; end: number }[]> = {};
    for (const p of pending) {
      const r = findCurrentRange(ranges, p.sourceAssetId, p.localStart, p.localEnd);
      if (!r) continue;
      if (!cutsByClipId[r.clip.id]) cutsByClipId[r.clip.id] = [];
      cutsByClipId[r.clip.id].push({ start: p.localStart, end: p.localEnd });
    }
    applyCutRanges(cutsByClipId);
    setPending([]);
    setSelectedMarkerId(null);
  }, [pending, ranges, applyCutRanges]);

  const dismissAll = useCallback(() => {
    setPending([]);
    setSelectedMarkerId(null);
  }, []);

  return {
    markers,
    analyzing,
    hasMostlySilentAsset,
    hasPending: pending.length > 0,
    selectedMarkerId,
    setSelectedMarkerId,
    analyze,
    removeMarker,
    dismissMarker,
    removeAll,
    dismissAll,
  };
}
