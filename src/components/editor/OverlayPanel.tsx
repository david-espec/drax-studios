"use client";

import { useRef } from "react";
import { Type, Image as ImageIcon, Square, Circle, Trash2, Subtitles } from "lucide-react";
import type { ImageOverlay, Overlay, ShapeOverlay, TextOverlay } from "@/lib/types";

export function OverlayPanel({
  overlays,
  playhead,
  totalDuration,
  onAdd,
  onUpdate,
  onRemove,
}: {
  overlays: Overlay[];
  playhead: number;
  totalDuration: number;
  onAdd: (overlay: Overlay) => void;
  onUpdate: (id: string, patch: Partial<Overlay>) => void;
  onRemove: (id: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function defaultWindow() {
    const start = playhead;
    const end = Math.min(totalDuration || start + 3, start + 3);
    return { start, end };
  }

  function addText(isCaption = false) {
    const { start, end } = defaultWindow();
    const overlay: TextOverlay = {
      id: crypto.randomUUID(),
      kind: "text",
      text: isCaption ? "Sua legenda aqui" : "Texto",
      start,
      end,
      x: 0.5,
      y: isCaption ? 0.88 : 0.5,
      color: "#ffffff",
      fontSize: isCaption ? 28 : 36,
      isCaption,
    };
    onAdd(overlay);
  }

  function addShape(shape: "rectangle" | "circle") {
    const { start, end } = defaultWindow();
    const overlay: ShapeOverlay = {
      id: crypto.randomUUID(),
      kind: "shape",
      shape,
      start,
      end,
      x: 0.35,
      y: 0.35,
      width: 0.3,
      height: 0.3,
      color: "#2f9bff",
    };
    onAdd(overlay);
  }

  function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const { start, end } = defaultWindow();
      const overlay: ImageOverlay = {
        id: crypto.randomUUID(),
        kind: "image",
        imageDataUrl: reader.result as string,
        start,
        end,
        x: 0.3,
        y: 0.3,
        width: 0.4,
        height: 0.4,
      };
      onAdd(overlay);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <h3 className="text-sm font-semibold">Elementos</h3>
      <div className="grid grid-cols-2 gap-2">
        <ToolButton icon={Type} label="Texto" onClick={() => addText(false)} />
        <ToolButton icon={Subtitles} label="Legenda" onClick={() => addText(true)} />
        <ToolButton icon={Square} label="Retângulo" onClick={() => addShape("rectangle")} />
        <ToolButton icon={Circle} label="Círculo" onClick={() => addShape("circle")} />
        <ToolButton icon={ImageIcon} label="Imagem" onClick={() => fileInputRef.current?.click()} full />
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleImagePick} />

      <div className="flex flex-col gap-2">
        {overlays.length === 0 && <p className="text-xs text-muted">Nenhum elemento adicionado.</p>}
        {overlays.map((overlay) => (
          <OverlayRow key={overlay.id} overlay={overlay} onUpdate={onUpdate} onRemove={onRemove} />
        ))}
      </div>
    </div>
  );
}

function ToolButton({
  icon: Icon,
  label,
  onClick,
  full,
}: {
  icon: typeof Type;
  label: string;
  onClick: () => void;
  full?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-lg border border-border bg-surface-2 px-2 py-2 text-xs font-medium hover:border-accent-blue ${
        full ? "col-span-2" : ""
      }`}
    >
      <Icon size={14} /> {label}
    </button>
  );
}

function OverlayRow({
  overlay,
  onUpdate,
  onRemove,
}: {
  overlay: Overlay;
  onUpdate: (id: string, patch: Partial<Overlay>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-2 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium capitalize">
          {overlay.kind === "text" ? (overlay.isCaption ? "Legenda" : "Texto") : overlay.kind === "shape" ? overlay.shape : "Imagem"}
        </span>
        <button onClick={() => onRemove(overlay.id)} className="text-muted hover:text-danger">
          <Trash2 size={13} />
        </button>
      </div>

      {overlay.kind === "text" && (
        <input
          value={overlay.text}
          onChange={(e) => onUpdate(overlay.id, { text: e.target.value })}
          className="mb-2 w-full rounded-md border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-accent-blue"
        />
      )}

      <div className="grid grid-cols-2 gap-2 text-[11px] text-muted">
        <label className="flex items-center gap-1">
          Início
          <input
            type="number"
            step={0.1}
            value={overlay.start.toFixed(1)}
            onChange={(e) => onUpdate(overlay.id, { start: Number(e.target.value) })}
            className="w-full rounded border border-border bg-surface px-1.5 py-1 text-foreground"
          />
        </label>
        <label className="flex items-center gap-1">
          Fim
          <input
            type="number"
            step={0.1}
            value={overlay.end.toFixed(1)}
            onChange={(e) => onUpdate(overlay.id, { end: Number(e.target.value) })}
            className="w-full rounded border border-border bg-surface px-1.5 py-1 text-foreground"
          />
        </label>
      </div>
    </div>
  );
}
