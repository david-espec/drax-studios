"use client";

import { useRouter } from "next/navigation";
import { deleteVideo, duplicateVideo, getVideo, updateVideoMeta } from "@/lib/db";

export function useVideoActions(onChange: () => void) {
  const router = useRouter();

  async function play(id: string) {
    const full = await getVideo(id);
    if (!full) return;
    const url = URL.createObjectURL(full.blob);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function rename(id: string, currentName: string) {
    const name = window.prompt("Novo nome do vídeo:", currentName);
    if (!name || name === currentName) return;
    await updateVideoMeta(id, { name });
    onChange();
  }

  async function duplicate(id: string) {
    await duplicateVideo(id);
    onChange();
  }

  async function download(id: string, name: string) {
    const full = await getVideo(id);
    if (!full) return;
    const url = URL.createObjectURL(full.blob);
    const a = document.createElement("a");
    const ext = full.mimeType.includes("mp4") ? "mp4" : "webm";
    a.href = url;
    a.download = `${name}.${ext}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function share(id: string, name: string) {
    const full = await getVideo(id);
    if (!full) return;
    const ext = full.mimeType.includes("mp4") ? "mp4" : "webm";
    const file = new File([full.blob], `${name}.${ext}`, { type: full.mimeType });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: name });
        return;
      } catch {
        // user cancelled or share failed — fall back to download
      }
    }
    await download(id, name);
  }

  async function remove(id: string) {
    if (!window.confirm("Excluir este vídeo? Essa ação não pode ser desfeita.")) return;
    await deleteVideo(id);
    onChange();
  }

  function edit(id: string) {
    router.push(`/editar?video=${id}`);
  }

  return { play, rename, duplicate, download, share, remove, edit };
}
