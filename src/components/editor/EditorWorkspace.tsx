"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Undo2, Redo2, Upload, Download, Loader2, Wand2, Trash2, X } from "lucide-react";
import { useEditorProject } from "@/hooks/useEditorProject";
import { useTimelinePlayer } from "@/hooks/useTimelinePlayer";
import { useSilenceMarkers } from "@/hooks/useSilenceMarkers";
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
import { formatDuration } from "@/lib/format";
import type { EditorProject, Resolution, VideoAsset } from "@/lib/types";

type Tab = "clip" | "overlays" | "audio";

export function EditorWorkspace({ initialProject }: { initialProject: EditorProject }) {
  const router = useRouter();
  const editor = useEditorProject(initialProject);
  const player = useTimelinePlayer(editor.project.clips);
  const [tab, setTab] = useState<Tab>("clip");
  const [showExport, setShowExport] = useState(false);
  const [savingAfterExport, setSavingAfterExport] = useState(false);
  const silence = useSilenceMarkers(player.ranges, editor.applyCutRanges);
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
            onClick={silence.analyze}
            disabled={silence.analyzing}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-2 disabled:opacity-50"
          >
            {silence.analyzing ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
            Detectar silêncios
          </button>
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

      {silence.hasPending && (
        <SilenceReviewBar
          markers={silence.markers}
          selectedMarkerId={silence.selectedMarkerId}
          onRemoveOne={silence.removeMarker}
          onIgnoreOne={silence.dismissMarker}
          onRemoveAll={silence.removeAll}
          onDismissAll={silence.dismissAll}
        />
      )}
      {!silence.hasPending && silence.hasMostlySilentAsset && (
        <div className="border-t border-border bg-surface px-4 py-2 text-xs text-muted">
          Um dos clipes parece não ter áudio perceptível (ex: gravação muda para adicionar música depois) — nenhum corte foi sugerido nele.
        </div>
      )}

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
        silenceMarkers={silence.markers}
        selectedMarkerId={silence.selectedMarkerId}
        onSelectMarker={silence.setSelectedMarkerId}
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

function SilenceReviewBar({
  markers,
  selectedMarkerId,
  onRemoveOne,
  onIgnoreOne,
  onRemoveAll,
  onDismissAll,
}: {
  markers: { id: string; globalStart: number; globalEnd: number }[];
  selectedMarkerId: string | null;
  onRemoveOne: (id: string) => void;
  onIgnoreOne: (id: string) => void;
  onRemoveAll: () => void;
  onDismissAll: () => void;
}) {
  const selected = markers.find((m) => m.id === selectedMarkerId);

  return (
    <div className="flex flex-col gap-2 border-t border-border bg-surface px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      {selected ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-accent-orange">●</span>
          <span>
            Silêncio de {formatDuration(selected.globalEnd - selected.globalStart)} em{" "}
            {formatDuration(selected.globalStart)}. Ouça no player antes de decidir.
          </span>
          <button
            onClick={() => onRemoveOne(selected.id)}
            className="flex items-center gap-1 rounded-lg bg-danger px-2.5 py-1 text-xs font-semibold text-white"
          >
            <Trash2 size={12} /> Remover este trecho
          </button>
          <button
            onClick={() => onIgnoreOne(selected.id)}
            className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-surface-2"
          >
            Ignorar
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted">
          {markers.length} trecho{markers.length > 1 ? "s" : ""} de silêncio marcado
          {markers.length > 1 ? "s" : ""} na timeline (laranja). Clique em um para revisar antes de remover.
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={onRemoveAll}
          className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-surface-2"
        >
          <Trash2 size={12} /> Remover todos
        </button>
        <button
          onClick={onDismissAll}
          className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-surface-2"
        >
          <X size={12} /> Descartar sugestões
        </button>
      </div>
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
