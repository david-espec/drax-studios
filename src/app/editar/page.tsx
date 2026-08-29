"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Upload, FolderOpen, Loader2 } from "lucide-react";
import { getVideo } from "@/lib/db";
import { importMediaFile } from "@/lib/import";
import { createInitialProject } from "@/hooks/useEditorProject";
import { EditorWorkspace } from "@/components/editor/EditorWorkspace";
import { useVideos } from "@/hooks/useVideos";
import { VideoThumbnail } from "@/components/VideoThumbnail";
import { formatDuration } from "@/lib/format";
import type { EditorProject } from "@/lib/types";

function EditarPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const videoId = searchParams.get("video");
  const [project, setProject] = useState<EditorProject | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!videoId) {
      setProject(null);
      return;
    }
    setLoading(true);
    getVideo(videoId).then((asset) => {
      if (asset) {
        setProject(createInitialProject(asset.name, asset.id, asset.durationSec || 1));
      }
      setLoading(false);
    });
  }, [videoId]);

  async function handleImport(file: File) {
    const asset = await importMediaFile(file);
    router.replace(`/editar?video=${asset.id}`);
  }

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center gap-2 text-sm text-muted">
        <Loader2 size={16} className="animate-spin" /> Carregando vídeo…
      </div>
    );
  }

  if (videoId && project) {
    return <EditorWorkspace key={project.id} initialProject={project} />;
  }

  return <ImportScreen onImport={handleImport} />;
}

function ImportScreen({ onImport }: { onImport: (file: File) => void }) {
  const { videos, loading } = useVideos();
  const router = useRouter();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-semibold">✂️ Editar Vídeo</h1>
      <p className="mb-6 text-sm text-muted">Importe um vídeo novo ou continue editando um vídeo salvo.</p>

      <label className="mb-8 flex cursor-pointer flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-surface p-10 text-center hover:border-accent-blue">
        <Upload size={28} className="text-accent-blue" />
        <span className="text-sm font-medium">Importar arquivo de vídeo</span>
        <span className="text-xs text-muted">MP4, WebM ou MOV do seu dispositivo</span>
        <input
          type="file"
          accept="video/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onImport(file);
          }}
        />
      </label>

      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <FolderOpen size={16} /> Ou escolha um vídeo salvo
      </div>

      {loading ? (
        <p className="text-sm text-muted">Carregando…</p>
      ) : videos.length === 0 ? (
        <p className="text-sm text-muted">Nenhum vídeo salvo ainda.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {videos.map((asset) => (
            <button
              key={asset.id}
              onClick={() => router.push(`/editar?video=${asset.id}`)}
              className="overflow-hidden rounded-xl border border-border bg-surface text-left hover:border-accent-blue"
            >
              <div className="relative aspect-video w-full">
                <VideoThumbnail asset={asset} className="h-full w-full" />
              </div>
              <div className="p-2">
                <p className="truncate text-xs font-medium">{asset.name}</p>
                <p className="text-[10px] text-muted">{formatDuration(asset.durationSec)}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EditarPage() {
  return (
    <Suspense fallback={null}>
      <EditarPageInner />
    </Suspense>
  );
}
