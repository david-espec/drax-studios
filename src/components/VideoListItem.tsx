"use client";

import { MoreVertical, Play, Pencil, Copy, Download, Share2, Trash2 } from "lucide-react";
import { useState } from "react";
import { VideoThumbnail } from "./VideoThumbnail";
import { formatBytes, formatDate, formatDuration } from "@/lib/format";
import { RESOLUTION_LABELS, RESOLUTION_DIMENSIONS } from "@/lib/types";
import type { Resolution, VideoAsset } from "@/lib/types";

function resolutionLabel(width: number, height: number): string {
  const match = (Object.entries(RESOLUTION_DIMENSIONS) as [Resolution, { width: number; height: number }][]).find(
    ([, dim]) => dim.height === height
  );
  return match ? RESOLUTION_LABELS[match[0]] : `${width}x${height}`;
}

export function VideoListItem({
  asset,
  onPlay,
  onRename,
  onDuplicate,
  onDownload,
  onShare,
  onDelete,
}: {
  asset: VideoAsset;
  onPlay: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDownload: () => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-2.5">
      <button onClick={onPlay} className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg">
        <VideoThumbnail asset={asset} className="h-full w-full" />
        <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 py-0.5 text-[10px] font-medium text-white">
          {formatDuration(asset.durationSec)}
        </span>
      </button>

      <button onClick={onPlay} className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-medium">{asset.name}</p>
        <p className="mt-0.5 truncate text-xs text-muted">
          {formatDate(asset.createdAt)} · {resolutionLabel(asset.width, asset.height)} · {formatBytes(asset.sizeBytes)}
        </p>
      </button>

      <div className="relative shrink-0">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-foreground"
        >
          <MoreVertical size={16} />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-8 z-20 w-44 overflow-hidden rounded-xl border border-border bg-surface-2 py-1 shadow-xl">
              <MenuItem icon={Play} label="Reproduzir" onClick={onPlay} />
              <MenuItem icon={Pencil} label="Renomear" onClick={onRename} />
              <MenuItem icon={Copy} label="Duplicar" onClick={onDuplicate} />
              <MenuItem icon={Download} label="Baixar" onClick={onDownload} />
              <MenuItem icon={Share2} label="Compartilhar" onClick={onShare} />
              <MenuItem icon={Trash2} label="Excluir" onClick={onDelete} danger />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: typeof Play;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/5 ${
        danger ? "text-danger" : "text-foreground"
      }`}
    >
      <Icon size={15} /> {label}
    </button>
  );
}
