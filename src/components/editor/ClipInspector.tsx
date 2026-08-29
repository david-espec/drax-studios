"use client";

import { Volume2, VolumeX, RotateCw } from "lucide-react";
import { OptionPicker } from "@/components/OptionPicker";
import type { ClipSegment, FilterPreset } from "@/lib/types";

const FILTERS: { value: FilterPreset; label: string }[] = [
  { value: "none", label: "Nenhum" },
  { value: "vivid", label: "Vívido" },
  { value: "grayscale", label: "P&B" },
  { value: "warm", label: "Quente" },
  { value: "cool", label: "Frio" },
  { value: "cinematic", label: "Cinemático" },
];

const SPEEDS = [0.25, 0.5, 1, 1.5, 2, 4];

export function ClipInspector({
  clip,
  onChange,
}: {
  clip: ClipSegment | null;
  onChange: (patch: Partial<ClipSegment>) => void;
}) {
  if (!clip) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted">
        Selecione um clipe na timeline para editar suas propriedades.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      <h3 className="text-sm font-semibold">Propriedades do clipe</h3>

      <OptionPicker
        label="Velocidade"
        value={clip.speed}
        options={SPEEDS.map((s) => ({ value: s, label: `${s}x` }))}
        onChange={(speed) => onChange({ speed })}
      />

      <OptionPicker
        label="Filtro"
        value={clip.filter}
        options={FILTERS}
        onChange={(filter) => onChange({ filter })}
      />

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Girar</p>
        <div className="flex gap-2">
          {[0, 90, 180, 270].map((r) => (
            <button
              key={r}
              onClick={() => onChange({ rotation: r as ClipSegment["rotation"] })}
              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
                clip.rotation === r ? "border-accent-blue bg-accent-blue/10" : "border-border bg-surface-2 text-muted"
              }`}
            >
              <RotateCw size={12} /> {r}°
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Volume</p>
          <button onClick={() => onChange({ muted: !clip.muted })} className="text-muted hover:text-foreground">
            {clip.muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
        </div>
        <input
          type="range"
          min={0}
          max={2}
          step={0.1}
          value={clip.volume}
          disabled={clip.muted}
          onChange={(e) => onChange({ volume: Number(e.target.value) })}
          className="w-full accent-[var(--accent-blue)] disabled:opacity-40"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Início (s)</p>
          <input
            type="number"
            step={0.1}
            value={clip.inPoint.toFixed(1)}
            onChange={(e) => onChange({ inPoint: Number(e.target.value) })}
            className="w-full rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-sm outline-none focus:border-accent-blue"
          />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Fim (s)</p>
          <input
            type="number"
            step={0.1}
            value={clip.outPoint.toFixed(1)}
            onChange={(e) => onChange({ outPoint: Number(e.target.value) })}
            className="w-full rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-sm outline-none focus:border-accent-blue"
          />
        </div>
      </div>
    </div>
  );
}
