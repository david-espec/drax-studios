"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/** Evento do Chrome para instalar o app; não está na tipagem padrão do DOM. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallOutcome = "aceito" | "recusado" | "indisponivel";

interface InstallValue {
  /** O navegador já está rodando o app instalado (modo standalone). */
  installed: boolean;
  /** Dá para abrir a caixa de instalação do próprio navegador. */
  canPrompt: boolean;
  /** iPhone e iPad não têm instalação automática: só pelo menu Compartilhar. */
  isIOS: boolean;
  /** Abre a caixa do navegador e espera a resposta do usuário. */
  install: () => Promise<InstallOutcome>;
}

const InstallContext = createContext<InstallValue | null>(null);

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function detectIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

/**
 * Guarda o evento de instalação do navegador.
 *
 * Precisa viver na raiz do app: o `beforeinstallprompt` dispara uma única vez,
 * logo no carregamento da página. Um ouvinte registrado dentro de uma tela que
 * só monta depois perderia o evento.
 */
export function InstallProvider({ children }: { children: ReactNode }) {
  const promptRef = useRef<InstallPromptEvent | null>(null);
  const [canPrompt, setCanPrompt] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    setInstalled(detectStandalone());
    setIsIOS(detectIOS());

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      promptRef.current = event as InstallPromptEvent;
      setCanPrompt(true);
    };
    const onInstalled = () => {
      promptRef.current = null;
      setCanPrompt(false);
      setInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    const standalone = window.matchMedia("(display-mode: standalone)");
    const onDisplayChange = (event: MediaQueryListEvent) => setInstalled(event.matches);
    standalone.addEventListener("change", onDisplayChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      standalone.removeEventListener("change", onDisplayChange);
    };
  }, []);

  const install = useCallback(async (): Promise<InstallOutcome> => {
    const event = promptRef.current;
    if (!event) return "indisponivel";

    await event.prompt();
    const { outcome } = await event.userChoice;
    promptRef.current = null;
    setCanPrompt(false);
    return outcome === "accepted" ? "aceito" : "recusado";
  }, []);

  const value = useMemo<InstallValue>(
    () => ({ installed, canPrompt, isIOS, install }),
    [installed, canPrompt, isIOS, install]
  );

  return <InstallContext.Provider value={value}>{children}</InstallContext.Provider>;
}

export function useInstall(): InstallValue {
  const context = useContext(InstallContext);
  if (!context) throw new Error("useInstall precisa estar dentro de <InstallProvider>");
  return context;
}
