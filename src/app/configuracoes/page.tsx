"use client";

import { useEffect, useState } from "react";
import { loadSettings, saveSettings, DEFAULT_SETTINGS, type AppSettings } from "@/lib/settings";
import { OptionPicker } from "@/components/OptionPicker";
import { RESOLUTION_LABELS } from "@/lib/types";
import type { Resolution, Fps, VideoFormat } from "@/lib/types";

const AUDIO_TOGGLES: { key: keyof AppSettings["audio"]; label: string; description: string }[] = [
  { key: "noiseSuppression", label: "Redução de ruído", description: "Reduz ruídos constantes de fundo (ventilador, ar-condicionado)." },
  { key: "echoCancellation", label: "Remoção de eco", description: "Evita eco ao usar alto-falantes." },
  { key: "autoGainControl", label: "Controle de ganho", description: "Ajusta automaticamente o volume de entrada do microfone." },
  { key: "voiceClarity", label: "Clareza da voz", description: "Realça as frequências da fala para melhor inteligibilidade." },
  { key: "normalizeVolume", label: "Normalização de volume", description: "Mantém o volume estável ao longo da gravação." },
];

export default function ConfiguracoesPage() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) saveSettings(settings);
  }, [settings, loaded]);

  if (!loaded) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-semibold">⚙️ Configurações</h1>
      <p className="mb-6 text-sm text-muted">Preferências padrão de gravação e processamento de áudio.</p>

      <section className="mb-6 rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold">Padrões de gravação</h2>
        <div className="flex flex-col gap-5">
          <OptionPicker
            label="Qualidade padrão"
            value={settings.defaultQuality}
            options={(["720p", "1080p", "1440p", "4k"] as Resolution[]).map((r) => ({
              value: r,
              label: RESOLUTION_LABELS[r],
            }))}
            onChange={(defaultQuality) => setSettings((s) => ({ ...s, defaultQuality }))}
          />
          <OptionPicker
            label="FPS padrão"
            value={settings.defaultFps}
            options={[24, 30, 60].map((v) => ({ value: v as Fps, label: `${v} FPS` }))}
            onChange={(defaultFps) => setSettings((s) => ({ ...s, defaultFps }))}
          />
          <OptionPicker
            label="Formato de exportação padrão"
            value={settings.defaultFormat}
            options={[
              { value: "mp4" as VideoFormat, label: "MP4" },
              { value: "webm" as VideoFormat, label: "WebM" },
            ]}
            onChange={(defaultFormat) => setSettings((s) => ({ ...s, defaultFormat }))}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-1 text-sm font-semibold">Processamento de áudio</h2>
        <p className="mb-4 text-xs text-muted">Ative ou desative os filtros aplicados durante a gravação.</p>

        <div className="flex flex-col divide-y divide-border">
          {AUDIO_TOGGLES.map((toggle) => (
            <label key={toggle.key} className="flex items-center justify-between gap-4 py-3">
              <span>
                <span className="block text-sm font-medium">{toggle.label}</span>
                <span className="block text-xs text-muted">{toggle.description}</span>
              </span>
              <Switch
                checked={settings.audio[toggle.key] as boolean}
                onChange={(checked) =>
                  setSettings((s) => ({ ...s, audio: { ...s.audio, [toggle.key]: checked } }))
                }
              />
            </label>
          ))}

          <div className="py-3">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium">Ganho de entrada</span>
              <span className="text-muted">{settings.audio.gain.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={settings.audio.gain}
              onChange={(e) =>
                setSettings((s) => ({ ...s, audio: { ...s.audio, gain: Number(e.target.value) } }))
              }
              className="w-full accent-[var(--accent-blue)]"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-accent-blue" : "bg-surface-2"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
