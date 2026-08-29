"use client";

import { useMemo, useState } from "react";
import { Search, FolderOpen } from "lucide-react";
import { useVideos } from "@/hooks/useVideos";
import { useVideoActions } from "@/hooks/useVideoActions";
import { VideoCard } from "@/components/VideoCard";

type SortKey = "date" | "name" | "size";

export default function VideosPage() {
  const { videos, loading, refresh } = useVideos();
  const actions = useVideoActions(refresh);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("date");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? videos.filter((v) => v.name.toLowerCase().includes(q)) : videos;
    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "size") return b.sizeBytes - a.sizeBytes;
      return b.createdAt - a.createdAt;
    });
    return sorted;
  }, [videos, query, sort]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">📁 Vídeos Prontos</h1>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar vídeos…"
              className="w-full rounded-lg border border-border bg-surface-2 py-2 pl-9 pr-3 text-sm outline-none focus:border-accent-blue sm:w-56"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none"
          >
            <option value="date">Mais recentes</option>
            <option value="name">Nome (A-Z)</option>
            <option value="size">Maior tamanho</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Carregando…</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-16 text-center text-sm text-muted">
          <FolderOpen size={32} />
          {videos.length === 0 ? "Nenhum vídeo salvo ainda." : "Nenhum vídeo encontrado para essa busca."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((asset) => (
            <VideoCard
              key={asset.id}
              asset={asset}
              onPlay={() => actions.play(asset.id)}
              onRename={() => actions.rename(asset.id, asset.name)}
              onDuplicate={() => actions.duplicate(asset.id)}
              onDownload={() => actions.download(asset.id, asset.name)}
              onShare={() => actions.share(asset.id, asset.name)}
              onDelete={() => actions.remove(asset.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
