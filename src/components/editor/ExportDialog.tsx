"use client";

import { useEffect, useRef, useState } from "react";
import { X, Download, Save } from "lucide-react";
import { OptionPicker } from "@/components/OptionPicker";
import { exportProject } from "@/lib/export";
import { formatBytes, formatDuration } from "@/lib/format";
import { RESOLUTION_LABELS } from "@/lib/types";
import type { EditorProject, Fps, Resolution, VideoFormat } from "@/lib/types";

const BITRATE_BPS: Record<Resolution, number> = {
  "720p": 2_500_000,
  "1080p": 5_000_000,
  "1440p": 9_000_000,
  "4k": 20_000_000,
};

export function ExportDialog({
  project,
  totalDuration,
  defaultResolution,
  defaultFps,
  defaultFormat,
  onClose,
  onSaved,
}: {
  project: EditorProject;
  totalDuration: number;
  defaultResolution: Resolution;
  defaultFps: Fps;
  defaultFormat: VideoFormat;
  onClose: () => void;
  onSaved: (blob: Blob, resolution: Resolution) => void;
}) {
  const [resolution, setResolution] = useState<Resolution>(defaultResolution);
  const [fps, setFps] = useState<Fps>(defaultFps);
  const [format, setFormat] = useState<VideoFormat>(defaultFormat);
  const [phase, setPhase] = useState<"config" | "processing" | "done" | "error">("config");
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const startTimeRef = useRef(0);
  const [elapsed, setElapsed] = useState(0);

  const estimatedBytes = (BITRATE_BPS[resolution] / 8) * totalDuration;

  useEffect(() => {
    if (phase !== "processing") return;
    const t = window.setInterval(() => setElapsed(Date.now() - startTimeRef.current), 300);
    return () => window.clearInterval(t);
  }, [phase]);

  async function handleExport() {
    setPhase("processing");
    setErrorMsg(null);
    startTimeRef.current = Date.now();
    try {
      const blob = await exportProject(project, { resolution, fps, format }, ({ ratio, stage }) => {
        setProgress(ratio);
        setStage(stage);
      });
      setResultBlob(blob);
      setPhase("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Falha ao exportar o vídeo.");
      setPhase("error");
    }
  }

  function download() {
    if (!resultBlob) return;
    const url = URL.createObjectURL(resultBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name}.${format}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  const estimatedRemainingMs = progress > 0.02 ? (elapsed / progress) * (1 - progress) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Exportar vídeo</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        {phase === "config" && (
          <div className="flex flex-col gap-5">
            <OptionPicker
              label="Qualidade"
              value={resolution}
              options={(["720p", "1080p", "1440p", "4k"] as Resolution[]).map((r) => ({
                value: r,
                label: RESOLUTION_LABELS[r],
              }))}
              onChange={setResolution}
            />
            <OptionPicker
              label="FPS"
              value={fps}
              options={[24, 30, 60].map((v) => ({ value: v as Fps, label: `${v} FPS` }))}
              onChange={setFps}
            />
            <OptionPicker
              label="Formato"
              value={format}
              options={[
                { value: "mp4" as VideoFormat, label: "MP4" },
                { value: "webm" as VideoFormat, label: "WebM" },
              ]}
              onChange={setFormat}
            />
            <p className="text-xs text-muted">
              Tamanho estimado: ~{formatBytes(estimatedBytes)} · Duração: {formatDuration(totalDuration)}
            </p>
            <button
              onClick={handleExport}
              className="brand-gradient-bg rounded-xl py-3 text-sm font-semibold text-black"
            >
              Iniciar exportação
            </button>
          </div>
        )}

        {phase === "processing" && (
          <div className="flex flex-col gap-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
              <div className="h-full brand-gradient-bg transition-all" style={{ width: `${progress * 100}%` }} />
            </div>
            <div className="flex justify-between text-xs text-muted">
              <span>{stage}</span>
              <span>{Math.round(progress * 100)}%</span>
            </div>
            <p className="text-xs text-muted">
              Qualidade: {RESOLUTION_LABELS[resolution]} · Tempo estimado restante:{" "}
              {estimatedRemainingMs > 0 ? formatDuration(estimatedRemainingMs / 1000) : "calculando…"}
            </p>
            <p className="text-xs text-muted">Tamanho aproximado: ~{formatBytes(estimatedBytes)}</p>
          </div>
        )}

        {phase === "error" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-danger">{errorMsg}</p>
            <button onClick={() => setPhase("config")} className="rounded-xl border border-border py-2 text-sm">
              Tentar novamente
            </button>
          </div>
        )}

        {phase === "done" && resultBlob && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-success">Exportação concluída! ({formatBytes(resultBlob.size)})</p>
            <button
              onClick={download}
              className="flex items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-surface-2"
            >
              <Download size={15} /> Baixar arquivo
            </button>
            <button
              onClick={() => onSaved(resultBlob, resolution)}
              className="flex items-center justify-center gap-2 rounded-xl brand-gradient-bg py-2.5 text-sm font-semibold text-black"
            >
              <Save size={15} /> Salvar em Vídeos Prontos
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
