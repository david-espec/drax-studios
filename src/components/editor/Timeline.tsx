"use client";

import { useCallback, useRef } from "react";
import { Scissors, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import type { ClipSegment } from "@/lib/types";
import type { ClipRange } from "@/hooks/useTimelinePlayer";
import { formatDuration } from "@/lib/format";

export interface SilenceMarker {
  id: string;
  globalStart: number;
  globalEnd: number;
}

export function Timeline({
  ranges,
  totalDuration,
  playhead,
  selectedClipId,
  onSelectClip,
  onSeek,
  onSplit,
  onRemove,
  onMove,
  onTrim,
  silenceMarkers,
  selectedMarkerId,
  onSelectMarker,
}: {
  ranges: ClipRange[];
  totalDuration: number;
  playhead: number;
  selectedClipId: string | null;
  onSelectClip: (id: string) => void;
  onSeek: (t: number) => void;
  onSplit: () => void;
  onRemove: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onTrim: (id: string, patch: Partial<ClipSegment>) => void;
  silenceMarkers?: SilenceMarker[];
  selectedMarkerId?: string | null;
  onSelectMarker?: (id: string) => void;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);

  const timeFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return 0;
      const rect = track.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return ratio * (totalDuration || 1);
    },
    [totalDuration]
  );

  const handleTrackPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).dataset.handle) return;
    const t = timeFromClientX(e.clientX);
    onSeek(t);
    const move = (ev: PointerEvent) => onSeek(timeFromClientX(ev.clientX));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const startTrimDrag = (
    e: React.PointerEvent,
    range: ClipRange,
    edge: "start" | "end"
  ) => {
    e.stopPropagation();
    const track = trackRef.current;
    if (!track) return;
    const trackWidth = track.getBoundingClientRect().width;
    const snapshotTotal = totalDuration || 1;

    const move = (ev: PointerEvent) => {
      const pixelDelta = ev.movementX;
      const globalDelta = (pixelDelta / trackWidth) * snapshotTotal;
      const sourceDelta = globalDelta * range.clip.speed;
      if (edge === "start") {
        const newIn = Math.min(range.clip.outPoint - 0.2, Math.max(0, range.clip.inPoint + sourceDelta));
        onTrim(range.clip.id, { inPoint: newIn });
      } else {
        const newOut = Math.max(range.clip.inPoint + 0.2, range.clip.outPoint + sourceDelta);
        onTrim(range.clip.id, { outPoint: newOut });
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div className="border-t border-border bg-surface px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={onSplit}
            disabled={!selectedClipId}
            className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-surface-2 disabled:opacity-40"
          >
            <Scissors size={13} /> Dividir
          </button>
          <button
            onClick={() => selectedClipId && onMove(selectedClipId, -1)}
            disabled={!selectedClipId}
            className="rounded-lg border border-border p-1.5 hover:bg-surface-2 disabled:opacity-40"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => selectedClipId && onMove(selectedClipId, 1)}
            disabled={!selectedClipId}
            className="rounded-lg border border-border p-1.5 hover:bg-surface-2 disabled:opacity-40"
          >
            <ChevronRight size={14} />
          </button>
          <button
            onClick={() => selectedClipId && onRemove(selectedClipId)}
            disabled={!selectedClipId}
            className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-danger hover:bg-danger/10 disabled:opacity-40"
          >
            <Trash2 size={13} /> Remover
          </button>
        </div>
        <span className="font-mono text-xs text-muted">
          {formatDuration(playhead)} / {formatDuration(totalDuration)}
        </span>
      </div>

      <div
        ref={trackRef}
        onPointerDown={handleTrackPointerDown}
        className="relative h-16 cursor-pointer select-none rounded-xl bg-surface-2"
      >
        <div className="flex h-full w-full gap-0.5 overflow-hidden rounded-xl">
          {ranges.map((range) => {
            const widthPct = ((range.globalEnd - range.globalStart) / (totalDuration || 1)) * 100;
            const selected = range.clip.id === selectedClipId;
            return (
              <div
                key={range.clip.id}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onSelectClip(range.clip.id);
                  onSeek(timeFromClientX(e.clientX));
                  const move = (ev: PointerEvent) => onSeek(timeFromClientX(ev.clientX));
                  const up = () => {
                    window.removeEventListener("pointermove", move);
                    window.removeEventListener("pointerup", up);
                  };
                  window.addEventListener("pointermove", move);
                  window.addEventListener("pointerup", up);
                }}
                style={{ width: `${widthPct}%` }}
                className={`relative flex h-full items-center justify-center border-r border-black/30 text-[10px] font-medium text-white/80 ${
                  selected ? "bg-accent-blue/40 ring-2 ring-accent-blue" : "bg-white/10"
                }`}
              >
                {selected && (
                  <>
                    <div
                      data-handle="start"
                      onPointerDown={(e) => startTrimDrag(e, range, "start")}
                      className="absolute left-0 top-0 h-full w-2 cursor-ew-resize bg-accent-blue"
                    />
                    <div
                      data-handle="end"
                      onPointerDown={(e) => startTrimDrag(e, range, "end")}
                      className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-accent-blue"
                    />
                  </>
                )}
                <span className="truncate px-1">{formatDuration(range.globalEnd - range.globalStart)}</span>
              </div>
            );
          })}
        </div>

        {(silenceMarkers ?? []).map((marker) => {
          const leftPct = (marker.globalStart / (totalDuration || 1)) * 100;
          const widthPct = ((marker.globalEnd - marker.globalStart) / (totalDuration || 1)) * 100;
          const selected = marker.id === selectedMarkerId;
          return (
            <div
              key={marker.id}
              onPointerDown={(e) => {
                e.stopPropagation();
                onSeek(marker.globalStart);
                onSelectMarker?.(marker.id);
              }}
              title="Trecho de silêncio detectado"
              className={`absolute bottom-0 h-2 cursor-pointer rounded-sm transition-all ${
                selected ? "bg-accent-orange ring-2 ring-accent-orange" : "bg-accent-orange/60 hover:bg-accent-orange"
              }`}
              style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 0.5)}%` }}
            />
          );
        })}

        <div
          className="pointer-events-none absolute top-0 h-full w-0.5 bg-accent-red"
          style={{ left: `${(playhead / (totalDuration || 1)) * 100}%` }}
        />
      </div>
    </div>
  );
}
