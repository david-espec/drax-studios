"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Settings, Download } from "lucide-react";
import { useInstall } from "@/install/InstallContext";
import { InstallDialog } from "@/install/InstallDialog";

export function HeaderActions() {
  const router = useRouter();
  const { installed } = useInstall();
  const [showInstall, setShowInstall] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => router.push("/videos")}
        aria-label="Pesquisar vídeos"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-foreground hover:bg-white/10"
      >
        <Search size={17} />
      </button>
      {!installed && (
        <button
          onClick={() => setShowInstall(true)}
          aria-label="Baixar app"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-foreground hover:bg-white/10"
        >
          <Download size={17} />
        </button>
      )}
      <button
        onClick={() => router.push("/configuracoes")}
        aria-label="Configurações"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-foreground hover:bg-white/10"
      >
        <Settings size={17} />
      </button>

      {showInstall && <InstallDialog onClose={() => setShowInstall(false)} />}
    </div>
  );
}
