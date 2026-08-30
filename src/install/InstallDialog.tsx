"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Check, X } from "lucide-react";
import { useInstall } from "./InstallContext";
import { Logo } from "@/components/Logo";

/** Passos manuais, para quando o navegador não oferece a caixa de instalação. */
function manualSteps(isIOS: boolean): string[] {
  if (isIOS) {
    return [
      "Toque no botão Compartilhar, o quadrado com a seta para cima.",
      'Role a lista e escolha "Adicionar à Tela de Início".',
      'Confirme em "Adicionar", no canto superior direito.',
    ];
  }
  return [
    "Abra o menu do navegador, os três pontinhos no canto.",
    'Escolha "Instalar app" ou "Adicionar à tela inicial".',
    'Confirme em "Instalar".',
  ];
}

export function InstallDialog({ onClose }: { onClose: () => void }) {
  const { canPrompt, isIOS, install } = useInstall();
  const cancelRef = useRef<HTMLButtonElement>(null);

  const [showingSteps, setShowingSteps] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function confirm() {
    if (working) return;
    if (!canPrompt) {
      setShowingSteps(true);
      return;
    }
    setWorking(true);
    const outcome = await install();
    setWorking(false);

    if (outcome === "aceito") {
      onClose();
      return;
    }
    if (outcome === "recusado") {
      onClose();
      return;
    }
    setShowingSteps(true);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="instalar-titulo"
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <Logo size={36} />
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <h2 id="instalar-titulo" className="mb-3 text-base font-semibold">
          {showingSteps ? "Como instalar no seu aparelho" : "Instalar o Drax Studio"}
        </h2>

        {showingSteps ? (
          <>
            <p className="mb-3 text-sm text-muted">
              Seu navegador não abre a janela de instalação sozinho. São três toques:
            </p>
            <ol className="mb-4 flex flex-col gap-2 text-sm">
              {manualSteps(isIOS).map((step, i) => (
                <li key={step} className="flex gap-2">
                  <span className="text-accent-blue">{i + 1}.</span>
                  {step}
                </li>
              ))}
            </ol>
            <button onClick={onClose} className="w-full rounded-xl brand-gradient-bg py-2.5 text-sm font-semibold text-black">
              Entendi
            </button>
          </>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted">
              O Drax Studio vai virar um ícone na tela inicial do seu aparelho e passa a abrir em janela
              própria, sem a barra do navegador.
            </p>

            <ul className="mb-4 flex flex-col gap-2 text-sm">
              <li className="flex gap-2">
                <Check size={16} className="mt-0.5 shrink-0 text-success" />
                Suas gravações e edições continuam só no seu dispositivo, como sempre.
              </li>
              <li className="flex gap-2">
                <Check size={16} className="mt-0.5 shrink-0 text-success" />
                Abre mais rápido, sem precisar digitar o endereço.
              </li>
              <li className="flex gap-2">
                <Check size={16} className="mt-0.5 shrink-0 text-success" />
                Não passa por loja de aplicativos, sem cadastro e sem rastreamento.
              </li>
            </ul>

            <p className="mb-4 text-xs text-muted">Para remover depois, é só apagar o ícone como faria com qualquer app.</p>

            <div className="flex gap-2">
              <button
                ref={cancelRef}
                onClick={onClose}
                className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-surface-2"
              >
                Cancelar
              </button>
              <button
                onClick={() => void confirm()}
                disabled={working}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl brand-gradient-bg py-2.5 text-sm font-semibold text-black disabled:opacity-60"
              >
                <Download size={15} />
                {working ? "Instalando…" : "Confirmar"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
