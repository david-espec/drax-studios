"use client";

import { useEffect, useRef, useState } from "react";
import { Music, VolumeX, Upload, X } from "lucide-react";
import { getVideo } from "@/lib/db";
import { importMediaFile } from "@/lib/import";
import type { EditorProject } from "@/lib/types";

export function AudioPanel({
  project,
  onMuteAll,
  onSetReplacedAudio,
  onSetMusicTrack,
}: {
  project: EditorProject;
  onMuteAll: () => void;
  onSetReplacedAudio: (assetId: string | null) => void;
  onSetMusicTrack: (assetId: string | null, volume?: number) => void;
}) {
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const musicInputRef = useRef<HTMLInputElement | null>(null);
  const [replacedName, setReplacedName] = useState<string | null>(null);
  const [musicName, setMusicName] = useState<string | null>(null);

  useEffect(() => {
    if (project.replacedAudioAssetId) {
      getVideo(project.replacedAudioAssetId).then((a) => setReplacedName(a?.name ?? null));
    } else {
      setReplacedName(null);
    }
  }, [project.replacedAudioAssetId]);

  useEffect(() => {
    if (project.musicTrack) {
      getVideo(project.musicTrack.assetId).then((a) => setMusicName(a?.name ?? null));
    } else {
      setMusicName(null);
    }
  }, [project.musicTrack]);

  return (
    <div className="flex flex-col gap-4 p-4">
      <h3 className="text-sm font-semibold">Áudio</h3>

      <button
        onClick={onMuteAll}
        className="flex items-center justify-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs font-medium hover:border-danger hover:text-danger"
      >
        <VolumeX size={14} /> Remover áudio de todos os clipes
      </button>

      <div className="rounded-xl border border-border bg-surface-2 p-3">
        <p className="mb-2 flex items-center gap-2 text-xs font-medium text-muted">
          <Upload size={13} /> Substituir áudio
        </p>
        {replacedName ? (
          <div className="flex items-center justify-between text-xs">
            <span className="truncate">{replacedName}</span>
            <button onClick={() => onSetReplacedAudio(null)} className="text-muted hover:text-danger">
              <X size={13} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => replaceInputRef.current?.click()}
            className="w-full rounded-lg border border-dashed border-border py-1.5 text-xs text-muted hover:border-accent-blue"
          >
            Escolher arquivo…
          </button>
        )}
        <input
          ref={replaceInputRef}
          type="file"
          accept="audio/*,video/*"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const asset = await importMediaFile(file);
            onSetReplacedAudio(asset.id);
            e.target.value = "";
          }}
        />
      </div>

      <div className="rounded-xl border border-border bg-surface-2 p-3">
        <p className="mb-2 flex items-center gap-2 text-xs font-medium text-muted">
          <Music size={13} /> Adicionar música de fundo
        </p>
        {musicName ? (
          <div className="flex flex-col gap-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="truncate">{musicName}</span>
              <button onClick={() => onSetMusicTrack(null)} className="text-muted hover:text-danger">
                <X size={13} />
              </button>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              defaultValue={project.musicTrack?.volume ?? 0.5}
              onChange={(e) => onSetMusicTrack(project.musicTrack!.assetId, Number(e.target.value))}
              className="w-full accent-[var(--accent-blue)]"
            />
          </div>
        ) : (
          <button
            onClick={() => musicInputRef.current?.click()}
            className="w-full rounded-lg border border-dashed border-border py-1.5 text-xs text-muted hover:border-accent-blue"
          >
            Escolher música…
          </button>
        )}
        <input
          ref={musicInputRef}
          type="file"
          accept="audio/*"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const asset = await importMediaFile(file);
            onSetMusicTrack(asset.id, 0.5);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
