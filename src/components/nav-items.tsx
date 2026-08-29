import { Video, Scissors, FolderOpen, Settings } from "lucide-react";
import type { ComponentType } from "react";

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  emoji: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/gravar", label: "Gravar Tela", icon: Video, emoji: "🎥" },
  { href: "/editar", label: "Editar Vídeo", icon: Scissors, emoji: "✂️" },
  { href: "/videos", label: "Vídeos Prontos", icon: FolderOpen, emoji: "📁" },
  { href: "/configuracoes", label: "Configurações", icon: Settings, emoji: "⚙️" },
];
