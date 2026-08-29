"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Circle, Pause, Play, Square, Mic, MicOff, AlertTriangle } from "lucide-react";
import { OptionPicker } from "@/components/OptionPicker";
import { useScreenRecorder } from "@/hooks/useScreenRecorder";
import { loadSettings } from "@/lib/settings";
import { saveVideo } from "@/lib/db";
import { generateThumbnail, getVideoMetadata } from "@/lib/export";
import { formatBytes, formatDuration } from "@/lib/format";
import type { AudioMode, CaptureSource, Fps, RecordingConfig, Resolution, VideoAsset } from "@/lib/types";
import { RESOLUTION_LABELS } from "@/lib/types";

const SOURCE_OPTIONS: { value: CaptureSource; label: string }[] = [
  { value: "screen", label: "Tela inteira" },
  { value: "window", label: "Janela específica" },
  { value: "tab", label: "Aba do navegador" },
  { value: "camera", label: "Câmera" },
];

const QUALITY_OPTIONS: { value: Resolution; label: string }[] = (
  ["720p", "1080p", "1440p", "4k"] as Resolution[]
).map((r) => ({ value: r, label: RESOLUTION_LABELS[r] }));

const FPS_OPTIONS: { value: Fps; label: string }[] = [
  { value: 24, label: "24 FPS" },
  { value: 30, label: "30 FPS" },
  { value: 60, label: "60 FPS" },
];

const AUDIO_OPTIONS: { value: AudioMode; label: string }[] = [
  { value: "mic", label: "Microfone" },
  { value: "system", label: "Áudio do sistema" },
  { value: "both", label: "Ambos" },
  { value: "none", label: "Sem áudio" },
];

export default function GravarPage() {
  const router = useRouter();
  const recorder = useScreenRecorder();
  const [config, setConfig] = useState<RecordingConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAsset, setSavedAsset] = useState<VideoAsset | null>(null);

  useEffect(() => {
    const s = loadSettings();
    setConfig({
      source: "screen",
      quality: s.defaultQuality,
      fps: s.defaultFps,
      audioMode: "both",
      includeCamera: false,
      orientation: "landscape",
    });
  }, []);

  const audioSettings = useMemo(() => loadSettings().audio, []);

  if (!config) return null;

  async function handleSave(destination: "videos" | "editar") {
    if (!recorder.resultBlob) return;
    setSaving(true);
    try {
      const meta = await getVideoMetadata(recorder.resultBlob);
      const thumbnailBlob = await generateThumbnail(recorder.resultBlob).catch(() => undefined);
      const asset: VideoAsset = {
        id: crypto.randomUUID(),
        name: `Gravação ${new Date().toLocaleString("pt-BR")}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        durationSec: meta.duration,
        width: meta.width,
        height: meta.height,
        sizeBytes: recorder.resultBlob.size,
        mimeType: recorder.resultBlob.type,
        status: "ready",
        source: "recording",
        thumbnailBlob,
      };
      await saveVideo(asset, recorder.resultBlob);
      setSavedAsset(asset);
      if (destination === "editar") {
        router.push(`/editar?video=${asset.id}`);
      }
    } finally {
      setSaving(false);
    }
  }

  if (recorder.phase === "recording" || recorder.phase === "paused") {
    return <RecordingOverlay recorder={recorder} />;
  }

  if (recorder.phase === "stopped" && recorder.resultBlob) {
    return (
      <ResultScreen
        blob={recorder.resultBlob}
        saving={saving}
        saved={!!savedAsset}
        onEdit={() => handleSave("editar")}
        onSave={() => handleSave("videos")}
        onDiscard={() => recorder.reset()}
        onGoLibrary={() => router.push("/videos")}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-semibold">🎥 Gravar Tela</h1>
      <p className="mb-6 text-sm text-muted">Configure a gravação e comece em poucos cliques.</p>

      {recorder.phase === "error" && recorder.errorMessage && (
        <div className="mb-6 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{recorder.errorMessage}</span>
        </div>
      )}

      <div className="flex flex-col gap-6 rounded-2xl border border-border bg-surface p-5">
        <OptionPicker
          label="Fonte da gravação"
          options={SOURCE_OPTIONS}
          value={config.source}
          onChange={(source) => setConfig({ ...config, source })}
        />
        <OptionPicker
          label="Qualidade"
          options={QUALITY_OPTIONS}
          value={config.quality}
          onChange={(quality) => setConfig({ ...config, quality })}
        />
        <OptionPicker
          label="FPS"
          options={FPS_OPTIONS}
          value={config.fps}
          onChange={(fps) => setConfig({ ...config, fps })}
        />
        <OptionPicker
          label="Áudio"
          options={AUDIO_OPTIONS}
          value={config.audioMode}
          onChange={(audioMode) => setConfig({ ...config, audioMode })}
        />

        {config.source !== "camera" && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={config.includeCamera}
              onChange={(e) => setConfig({ ...config, includeCamera: e.target.checked })}
              className="h-4 w-4 rounded border-border accent-[var(--accent-blue)]"
            />
            Incluir câmera (webcam) sobreposta
          </label>
        )}

        <OptionPicker
          label="Orientação"
          options={[
            { value: "landscape", label: "Horizontal" },
            { value: "portrait", label: "Vertical" },
          ]}
          value={config.orientation}
          onChange={(orientation) => setConfig({ ...config, orientation })}
        />

        <button
          onClick={() => recorder.start(config, audioSettings)}
          disabled={recorder.phase === "requesting"}
          className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-danger px-5 py-3.5 text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          <Circle size={16} className="fill-white" />
          {recorder.phase === "requesting" ? "Aguardando permissão…" : "INICIAR GRAVAÇÃO"}
        </button>
      </div>
    </div>
  );
}

function RecordingOverlay({ recorder }: { recorder: ReturnType<typeof useScreenRecorder> }) {
  const isPaused = recorder.phase === "paused";
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-8 px-4 py-10">
      <div className="flex flex-col items-center gap-3">
        <div className={`h-3 w-3 rounded-full bg-danger ${isPaused ? "" : "animate-pulse"}`} />
        <p className="text-sm text-muted">{isPaused ? "Gravação pausada" : "Gravando…"}</p>
        <p className="font-mono text-4xl font-semibold tabular-nums">{formatDuration(recorder.elapsedMs / 1000)}</p>
      </div>

      <div className="flex items-center gap-2">
        {recorder.audioLevel > 0.02 ? <Mic size={16} className="text-success" /> : <MicOff size={16} className="text-muted" />}
        <div className="h-2 w-40 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full bg-success transition-all"
            style={{ width: `${Math.round(recorder.audioLevel * 100)}%` }}
          />
        </div>
      </div>

      {recorder.warnings.length > 0 && (
        <div className="max-w-md rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-200">
          {recorder.warnings.map((w, i) => (
            <p key={i}>{w.message}</p>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 shadow-2xl">
        {isPaused ? (
          <ControlButton icon={Play} label="Continuar" onClick={recorder.resume} />
        ) : (
          <ControlButton icon={Pause} label="Pausar" onClick={recorder.pause} />
        )}
        <ControlButton icon={Square} label="Finalizar" onClick={recorder.finish} danger />
      </div>
    </div>
  );
}

function ControlButton({
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
      className={`flex flex-col items-center gap-1 rounded-xl px-4 py-2 text-xs font-medium ${
        danger ? "text-danger hover:bg-danger/10" : "text-foreground hover:bg-surface-2"
      }`}
    >
      <Icon size={20} className={danger ? "fill-danger/20" : ""} />
      {label}
    </button>
  );
}

function ResultScreen({
  blob,
  saving,
  saved,
  onEdit,
  onSave,
  onDiscard,
  onGoLibrary,
}: {
  blob: Blob;
  saving: boolean;
  saved: boolean;
  onEdit: () => void;
  onSave: () => void;
  onDiscard: () => void;
  onGoLibrary: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ duration: number; width: number; height: number } | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    getVideoMetadata(blob).then(setMeta).catch(() => {});
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-semibold">Gravação concluída!</h1>
      <p className="mb-6 text-sm text-muted">Revise abaixo e escolha o que fazer com o vídeo.</p>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        {url && <video src={url} controls className="aspect-video w-full bg-black" />}
        <div className="grid grid-cols-2 gap-3 p-4 text-sm sm:grid-cols-4">
          <Stat label="Duração" value={meta ? formatDuration(meta.duration) : "…"} />
          <Stat label="Resolução" value={meta ? `${meta.width}x${meta.height}` : "…"} />
          <Stat label="Tamanho" value={formatBytes(blob.size)} />
          <Stat label="Qualidade do áudio" value="Processada" />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ActionButton label="Editar vídeo" onClick={onEdit} primary disabled={saving} />
        <ActionButton label={saved ? "Salvo ✓" : "Salvar"} onClick={onSave} disabled={saving || saved} />
        <ActionButton label="Vídeos Prontos" onClick={onGoLibrary} disabled={!saved} />
        <ActionButton label="Excluir" onClick={onDiscard} danger disabled={saving} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  primary,
  danger,
  disabled,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl px-4 py-3 text-sm font-semibold transition-opacity disabled:opacity-40 ${
        primary
          ? "brand-gradient-bg text-black"
          : danger
          ? "border border-danger/40 text-danger hover:bg-danger/10"
          : "border border-border bg-surface-2 hover:bg-white/5"
      }`}
    >
      {label}
    </button>
  );
}
