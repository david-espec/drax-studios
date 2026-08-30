"use client";

import { useEffect, useState } from "react";
import { X, Wand2, Loader2 } from "lucide-react";
import { getVideo } from "@/lib/db";
import { detectSilentRanges } from "@/lib/silence-detection";
import { formatDuration } from "@/lib/format";
import type { ClipRange } from "@/hooks/useTimelinePlayer";

interface Suggestion {
  id: string;
  clipId: string;
  localStart: number;
  localEnd: number;
  globalStart: number;
  globalEnd: number;
  included: boolean;
}

type Phase = "analyzing" | "results" | "error";

export function SmartCutDialog({
  ranges,
  onApply,
  onClose,
}: {
  ranges: ClipRange[];
  onApply: (cutsByClipId: Record<string, { start: number; end: number }[]>) => void;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("analyzing");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const rangesByAsset = new Map<string, ClipRange[]>();
        for (const range of ranges) {
          const list = rangesByAsset.get(range.clip.sourceAssetId) ?? [];
          list.push(range);
          rangesByAsset.set(range.clip.sourceAssetId, list);
        }

        const found: Suggestion[] = [];
        for (const [assetId, clipRanges] of rangesByAsset) {
          const asset = await getVideo(assetId);
          if (!asset) continue;
          const silentRanges = await detectSilentRanges(asset.blob);
          for (const clipRange of clipRanges) {
            const { clip, globalStart } = clipRange;
            for (const silent of silentRanges) {
              const localStart = Math.max(clip.inPoint, silent.start);
              const localEnd = Math.min(clip.outPoint, silent.end);
              if (localEnd <= localStart) continue;
              found.push({
                id: crypto.randomUUID(),
                clipId: clip.id,
                localStart,
                localEnd,
                globalStart: globalStart + (localStart - clip.inPoint) / clip.speed,
                globalEnd: globalStart + (localEnd - clip.inPoint) / clip.speed,
                included: true,
              });
            }
          }
        }

        if (!cancelled) {
          found.sort((a, b) => a.globalStart - b.globalStart);
          setSuggestions(found);
          setPhase("results");
        }
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : "Falha ao analisar o áudio.");
          setPhase("error");
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(id: string) {
    setSuggestions((list) => list.map((s) => (s.id === id ? { ...s, included: !s.included } : s)));
  }

  function apply() {
    const cutsByClipId: Record<string, { start: number; end: number }[]> = {};
    for (const s of suggestions) {
      if (!s.included) continue;
      if (!cutsByClipId[s.clipId]) cutsByClipId[s.clipId] = [];
      cutsByClipId[s.clipId].push({ start: s.localStart, end: s.localEnd });
    }
    onApply(cutsByClipId);
  }

  const includedCount = suggestions.filter((s) => s.included).length;
  const totalSavedSec = suggestions.filter((s) => s.included).reduce((acc, s) => acc + (s.globalEnd - s.globalStart), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Wand2 size={17} /> Corte inteligente
          </h2>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        {phase === "analyzing" && (
          <div className="flex flex-col items-center gap-3 py-10 text-sm text-muted">
            <Loader2 size={20} className="animate-spin" />
            Analisando o áudio em busca de silêncios…
          </div>
        )}

        {phase === "error" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-danger">{errorMsg}</p>
            <button onClick={onClose} className="rounded-xl border border-border py-2 text-sm">
              Fechar
            </button>
          </div>
        )}

        {phase === "results" && suggestions.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted">
            Nenhum trecho de silêncio significativo encontrado (ou os clipes não têm áudio para analisar).
          </div>
        )}

        {phase === "results" && suggestions.length > 0 && (
          <>
            <p className="mb-3 text-sm text-muted">
              Encontramos {suggestions.length} trecho{suggestions.length > 1 ? "s" : ""} de silêncio.
              Selecionados: {includedCount} (~{formatDuration(totalSavedSec)} a menos no vídeo).
            </p>
            <div className="flex-1 overflow-y-auto rounded-xl border border-border">
              {suggestions.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-3 border-b border-border px-3 py-2.5 text-sm last:border-b-0 hover:bg-surface-2"
                >
                  <input
                    type="checkbox"
                    checked={s.included}
                    onChange={() => toggle(s.id)}
                    className="h-4 w-4 rounded border-border accent-[var(--accent-blue)]"
                  />
                  <span className="flex-1">
                    {formatDuration(s.globalStart)} – {formatDuration(s.globalEnd)}
                  </span>
                  <span className="text-xs text-muted">{formatDuration(s.globalEnd - s.globalStart)}</span>
                </label>
              ))}
            </div>
            <button
              onClick={apply}
              disabled={includedCount === 0}
              className="mt-4 rounded-xl brand-gradient-bg py-3 text-sm font-semibold text-black disabled:opacity-40"
            >
              Aplicar {includedCount} corte{includedCount === 1 ? "" : "s"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
