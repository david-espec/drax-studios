"use client";

import Link from "next/link";
import { MoreVertical, Play, Pencil, Copy, Download, Share2, Trash2 } from "lucide-react";
import { useState } from "react";
import { VideoThumbnail } from "./VideoThumbnail";
import { formatBytes, formatDate, formatDuration } from "@/lib/format";
import type { VideoAsset } from "@/lib/types";

export function VideoCard({
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
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-surface transition-colors hover:border-white/20">
      <button onClick={onPlay} className="block w-full text-left">
        <div className="relative aspect-video w-full overflow-hidden">
          <VideoThumbnail asset={asset} className="h-full w-full" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100">
            <Play size={32} className="fill-white text-white" />
          </div>
          {asset.status === "processing" && (
            <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white">
              Processando…
            </span>
          )}
        </div>
      </button>

      <div className="flex items-start justify-between gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{asset.name}</p>
          <p className="mt-0.5 text-xs text-muted">
            {formatDate(asset.createdAt)} · {formatDuration(asset.durationSec)} · {asset.width}x{asset.height} ·{" "}
            {formatBytes(asset.sizeBytes)}
          </p>
        </div>
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
                <MenuItem
                  icon={Pencil}
                  label="Editar"
                  href={`/editar?video=${asset.id}`}
                />
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
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  href,
  danger,
}: {
  icon: typeof Play;
  label: string;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
}) {
  const className = `flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/5 ${
    danger ? "text-danger" : "text-foreground"
  }`;
  if (href) {
    return (
      <Link href={href} className={className}>
        <Icon size={15} /> {label}
      </Link>
    );
  }
  return (
    <button onClick={onClick} className={className}>
      <Icon size={15} /> {label}
    </button>
  );
}
