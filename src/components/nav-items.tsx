import { Home, Video, Scissors, FolderOpen, Settings } from "lucide-react";
import type { ComponentType } from "react";

export interface NavItem {
  href: string;
  label: string;
  shortLabel: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  emoji: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Início", shortLabel: "Início", icon: Home, emoji: "🏠" },
  { href: "/gravar", label: "Gravar Tela", shortLabel: "Gravar", icon: Video, emoji: "🎥" },
  { href: "/editar", label: "Editar Vídeo", shortLabel: "Editar", icon: Scissors, emoji: "✂️" },
  { href: "/videos", label: "Vídeos Prontos", shortLabel: "Vídeos", icon: FolderOpen, emoji: "📁" },
  { href: "/configuracoes", label: "Configurações", shortLabel: "Ajustes", icon: Settings, emoji: "⚙️" },
];

/** Itens da navegação inferior no mobile — Configurações fica atrás do ícone de engrenagem no cabeçalho. */
export const MOBILE_NAV_ITEMS = NAV_ITEMS.filter((item) => item.href !== "/configuracoes");
