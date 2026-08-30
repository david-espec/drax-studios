"use client";

import { useCallback, useMemo, useState } from "react";
import type { ClipSegment, EditorProject, Overlay } from "@/lib/types";

function cloneProject(p: EditorProject): EditorProject {
  return JSON.parse(JSON.stringify(p));
}

export function createInitialProject(name: string, sourceAssetId: string, sourceDuration: number): EditorProject {
  const now = Date.now();
  const clip: ClipSegment = {
    id: crypto.randomUUID(),
    sourceAssetId,
    inPoint: 0,
    outPoint: sourceDuration,
    speed: 1,
    volume: 1,
    muted: false,
    filter: "none",
    rotation: 0,
  };
  return {
    id: crypto.randomUUID(),
    name,
    clips: [clip],
    overlays: [],
    musicTrack: null,
    replacedAudioAssetId: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function useEditorProject(initial: EditorProject) {
  const [past, setPast] = useState<EditorProject[]>([]);
  const [present, setPresent] = useState<EditorProject>(initial);
  const [future, setFuture] = useState<EditorProject[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(initial.clips[0]?.id ?? null);

  const commit = useCallback((updater: (draft: EditorProject) => EditorProject) => {
    setPresent((current) => {
      const draft = cloneProject(current);
      const next = updater(draft);
      next.updatedAt = Date.now();
      setPast((p) => [...p, current]);
      setFuture([]);
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p;
      const prev = p[p.length - 1];
      setFuture((f) => [present, ...f]);
      setPresent(prev);
      return p.slice(0, -1);
    });
  }, [present]);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      setPast((p) => [...p, present]);
      setPresent(next);
      return f.slice(1);
    });
  }, [present]);

  const updateClip = useCallback(
    (id: string, patch: Partial<ClipSegment>) => {
      commit((draft) => {
        draft.clips = draft.clips.map((c) => (c.id === id ? { ...c, ...patch } : c));
        return draft;
      });
    },
    [commit]
  );

  const removeClip = useCallback(
    (id: string) => {
      commit((draft) => {
        draft.clips = draft.clips.filter((c) => c.id !== id);
        return draft;
      });
      setSelectedClipId((cur) => (cur === id ? null : cur));
    },
    [commit]
  );

  const moveClip = useCallback(
    (id: string, direction: -1 | 1) => {
      commit((draft) => {
        const idx = draft.clips.findIndex((c) => c.id === id);
        const targetIdx = idx + direction;
        if (idx < 0 || targetIdx < 0 || targetIdx >= draft.clips.length) return draft;
        const clips = [...draft.clips];
        [clips[idx], clips[targetIdx]] = [clips[targetIdx], clips[idx]];
        draft.clips = clips;
        return draft;
      });
    },
    [commit]
  );

  const splitClip = useCallback(
    (id: string, sourceSplitTime: number) => {
      commit((draft) => {
        const idx = draft.clips.findIndex((c) => c.id === id);
        if (idx < 0) return draft;
        const clip = draft.clips[idx];
        if (sourceSplitTime <= clip.inPoint + 0.05 || sourceSplitTime >= clip.outPoint - 0.05) return draft;
        const first: ClipSegment = { ...clip, outPoint: sourceSplitTime };
        const second: ClipSegment = { ...clip, id: crypto.randomUUID(), inPoint: sourceSplitTime };
        const clips = [...draft.clips];
        clips.splice(idx, 1, first, second);
        draft.clips = clips;
        return draft;
      });
    },
    [commit]
  );

  const applyCutRanges = useCallback(
    (cutsByClipId: Record<string, { start: number; end: number }[]>) => {
      commit((draft) => {
        const newClips: ClipSegment[] = [];
        for (const clip of draft.clips) {
          const cuts = cutsByClipId[clip.id];
          if (!cuts || cuts.length === 0) {
            newClips.push(clip);
            continue;
          }
          const sorted = [...cuts].sort((a, b) => a.start - b.start);
          let cursor = clip.inPoint;
          for (const cut of sorted) {
            const cutStart = Math.max(clip.inPoint, cut.start);
            const cutEnd = Math.min(clip.outPoint, cut.end);
            if (cutStart > cursor) {
              newClips.push({ ...clip, id: crypto.randomUUID(), inPoint: cursor, outPoint: cutStart });
            }
            cursor = Math.max(cursor, cutEnd);
          }
          if (cursor < clip.outPoint) {
            newClips.push({ ...clip, id: crypto.randomUUID(), inPoint: cursor, outPoint: clip.outPoint });
          }
        }
        draft.clips = newClips;
        return draft;
      });
      setSelectedClipId(null);
    },
    [commit]
  );

  const addClip = useCallback(
    (sourceAssetId: string, sourceDuration: number) => {
      commit((draft) => {
        const clip: ClipSegment = {
          id: crypto.randomUUID(),
          sourceAssetId,
          inPoint: 0,
          outPoint: sourceDuration,
          speed: 1,
          volume: 1,
          muted: false,
          filter: "none",
          rotation: 0,
        };
        draft.clips = [...draft.clips, clip];
        return draft;
      });
    },
    [commit]
  );

  const addOverlay = useCallback(
    (overlay: Overlay) => {
      commit((draft) => {
        draft.overlays = [...draft.overlays, overlay];
        return draft;
      });
    },
    [commit]
  );

  const updateOverlay = useCallback(
    (id: string, patch: Partial<Overlay>) => {
      commit((draft) => {
        draft.overlays = draft.overlays.map((o) => (o.id === id ? ({ ...o, ...patch } as Overlay) : o));
        return draft;
      });
    },
    [commit]
  );

  const removeOverlay = useCallback(
    (id: string) => {
      commit((draft) => {
        draft.overlays = draft.overlays.filter((o) => o.id !== id);
        return draft;
      });
    },
    [commit]
  );

  const setMusicTrack = useCallback(
    (assetId: string | null, volume = 0.5) => {
      commit((draft) => {
        draft.musicTrack = assetId ? { assetId, volume } : null;
        return draft;
      });
    },
    [commit]
  );

  const setReplacedAudio = useCallback(
    (assetId: string | null) => {
      commit((draft) => {
        draft.replacedAudioAssetId = assetId;
        return draft;
      });
    },
    [commit]
  );

  const totalDuration = useMemo(
    () => present.clips.reduce((acc, c) => acc + (c.outPoint - c.inPoint) / c.speed, 0),
    [present.clips]
  );

  return {
    project: present,
    totalDuration,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    undo,
    redo,
    updateClip,
    removeClip,
    moveClip,
    splitClip,
    applyCutRanges,
    addClip,
    addOverlay,
    updateOverlay,
    removeOverlay,
    setMusicTrack,
    setReplacedAudio,
    selectedClipId,
    setSelectedClipId,
  };
}
