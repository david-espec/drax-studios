"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Undo2, Redo2, Upload, Download, Loader2 } from "lucide-react";
import { useEditorProject } from "@/hooks/useEditorProject";
import { useTimelinePlayer } from "@/hooks/useTimelinePlayer";
import { PreviewStage } from "./PreviewStage";
import { Timeline } from "./Timeline";
import { ClipInspector } from "./ClipInspector";
import { OverlayPanel } from "./OverlayPanel";
import { AudioPanel } from "./AudioPanel";
import { ExportDialog } from "./ExportDialog";
import { importMediaFile } from "@/lib/import";
import { generateThumbnail, getVideoMetadata } from "@/lib/export";
import { saveVideo } from "@/lib/db";
import { loadSettings } from "@/lib/settings";
import type { EditorProject, Resolution, VideoAsset } from "@/lib/types";

type Tab = "clip" | "overlays" | "audio";

export function EditorWorkspace({ initialProject }: { initialProject: EditorProject }) {
  const router = useRouter();
  const editor = useEditorProject(initialProject);
  const player = useTimelinePlayer(editor.project.clips);
  const [tab, setTab] = useState<Tab>("clip");
  const [showExport, setShowExport] = useState(false);
  const [savingAfterExport, setSavingAfterExport] = useState(false);
  const addClipInputRef = useRef<HTMLInputElement | null>(null);
  const settings = loadSettings();

  const selectedClip = editor.project.clips.find((c) => c.id === editor.selectedClipId) ?? null;
  const selectedRange = player.ranges.find((r) => r.clip.id === editor.selectedClipId);

  function handleSplit() {
    if (!selectedRange) return;
    const localTime = selectedRange.clip.inPoint + (player.playhead - selectedRange.globalStart) * selectedRange.clip.speed;
    editor.splitClip(selectedRange.clip.id, localTime);
  }

  async function handleAddClip(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const asset = await importMediaFile(file);
    editor.addClip(asset.id, asset.durationSec);
    e.target.value = "";
  }

  async function handleExportSaved(blob: Blob, resolution: Resolution) {
    setSavingAfterExport(true);
    try {
      const meta = await getVideoMetadata(blob);
      const thumbnailBlob = await generateThumbnail(blob).catch(() => undefined);
      const asset: VideoAsset = {
        id: crypto.randomUUID(),
        name: editor.project.name,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        durationSec: meta.duration,
        width: meta.width,
        height: meta.height,
        sizeBytes: blob.size,
        mimeType: blob.type,
        status: "ready",
        source: "export",
        thumbnailBlob,
      };
      void resolution;
      await saveVideo(asset, blob);
      router.push("/videos");
    } catch {
      window.alert(
        "Não foi possível processar o vídeo exportado neste navegador (pode faltar suporte a um codec). Tente baixar o arquivo ou exportar em outro formato."
      );
    } finally {
      setSavingAfterExport(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-1px)] flex-col md:h-screen">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <button onClick={editor.undo} disabled={!editor.canUndo} className="rounded-lg p-2 hover:bg-surface-2 disabled:opacity-30">
            <Undo2 size={16} />
          </button>
          <button onClick={editor.redo} disabled={!editor.canRedo} className="rounded-lg p-2 hover:bg-surface-2 disabled:opacity-30">
            <Redo2 size={16} />
          </button>
          <span className="ml-1 truncate text-sm font-medium">{editor.project.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => addClipInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-2"
          >
            <Upload size={13} /> Adicionar vídeo
          </button>
          <input ref={addClipInputRef} type="file" accept="video/*" hidden onChange={handleAddClip} />
          <button
            onClick={() => setShowExport(true)}
            className="flex items-center gap-1.5 rounded-lg brand-gradient-bg px-3 py-1.5 text-xs font-semibold text-black"
          >
            <Download size={13} /> Exportar
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
        <div className="flex flex-1 items-center justify-center overflow-auto p-4">
          <PreviewStage
            videoRef={player.videoRef}
            overlays={editor.project.overlays}
            playhead={player.playhead}
            isPlaying={player.isPlaying}
            onTogglePlay={() => (player.isPlaying ? player.pause() : player.play())}
          />
        </div>

        <div className="w-full shrink-0 overflow-y-auto border-t border-border bg-surface md:w-72 md:border-l md:border-t-0">
          <div className="flex border-b border-border text-xs font-medium">
            <TabButton label="Clipe" active={tab === "clip"} onClick={() => setTab("clip")} />
            <TabButton label="Elementos" active={tab === "overlays"} onClick={() => setTab("overlays")} />
            <TabButton label="Áudio" active={tab === "audio"} onClick={() => setTab("audio")} />
          </div>

          {tab === "clip" && (
            <ClipInspector clip={selectedClip} onChange={(patch) => selectedClip && editor.updateClip(selectedClip.id, patch)} />
          )}
          {tab === "overlays" && (
            <OverlayPanel
              overlays={editor.project.overlays}
              playhead={player.playhead}
              totalDuration={player.totalDuration}
              onAdd={editor.addOverlay}
              onUpdate={editor.updateOverlay}
              onRemove={editor.removeOverlay}
            />
          )}
          {tab === "audio" && (
            <AudioPanel
              project={editor.project}
              onMuteAll={() => editor.project.clips.forEach((c) => editor.updateClip(c.id, { muted: true }))}
              onSetReplacedAudio={editor.setReplacedAudio}
              onSetMusicTrack={editor.setMusicTrack}
            />
          )}
        </div>
      </div>

      <Timeline
        ranges={player.ranges}
        totalDuration={player.totalDuration}
        playhead={player.playhead}
        selectedClipId={editor.selectedClipId}
        onSelectClip={editor.setSelectedClipId}
        onSeek={player.seek}
        onSplit={handleSplit}
        onRemove={editor.removeClip}
        onMove={editor.moveClip}
        onTrim={editor.updateClip}
      />

      {showExport && (
        <ExportDialog
          project={editor.project}
          totalDuration={player.totalDuration}
          defaultResolution={settings.defaultQuality}
          defaultFps={settings.defaultFps}
          defaultFormat={settings.defaultFormat}
          onClose={() => setShowExport(false)}
          onSaved={handleExportSaved}
        />
      )}

      {savingAfterExport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="flex items-center gap-2 rounded-xl bg-surface px-4 py-3 text-sm">
            <Loader2 size={16} className="animate-spin" /> Salvando em Vídeos Prontos…
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 border-b-2 px-3 py-2.5 ${
        active ? "border-accent-blue text-foreground" : "border-transparent text-muted"
      }`}
    >
      {label}
    </button>
  );
}
