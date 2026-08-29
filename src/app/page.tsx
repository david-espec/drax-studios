"use client";

import Link from "next/link";
import { useVideos } from "@/hooks/useVideos";
import { useVideoActions } from "@/hooks/useVideoActions";
import { VideoCard } from "@/components/VideoCard";
import { Logo } from "@/components/Logo";

export default function DashboardPage() {
  const { videos, loading, refresh } = useVideos();
  const actions = useVideoActions(refresh);
  const recent = videos.slice(0, 6);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-8 md:py-14">
      <div className="flex flex-col items-center gap-4 text-center">
        <Logo size={56} />
        <h1 className="text-2xl font-semibold md:text-3xl">O que você deseja fazer?</h1>
        <p className="max-w-md text-sm text-muted">
          Grave sua tela, edite com uma timeline simples e encontre tudo depois em Vídeos Prontos.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <ActionCard
          href="/gravar"
          emoji="🎥"
          title="Gravar Tela"
          description="Começar uma nova gravação."
          accent="from-accent-blue/20 to-accent-blue/0"
        />
        <ActionCard
          href="/editar"
          emoji="✂️"
          title="Editar Vídeo"
          description="Importar um vídeo e começar a edição."
          accent="from-accent-orange/20 to-accent-orange/0"
        />
        <ActionCard
          href="/videos"
          emoji="📁"
          title="Vídeos Prontos"
          description="Ver os vídeos já gravados e editados."
          accent="from-accent-red/20 to-accent-red/0"
        />
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recentes</h2>
          {videos.length > 0 && (
            <Link href="/videos" className="text-sm text-accent-blue hover:underline">
              Ver todos
            </Link>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-muted">Carregando…</p>
        ) : recent.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted">
            Nenhum vídeo por aqui ainda. Comece gravando sua tela.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((asset) => (
              <VideoCard
                key={asset.id}
                asset={asset}
                onPlay={() => actions.play(asset.id)}
                onRename={() => actions.rename(asset.id, asset.name)}
                onDuplicate={() => actions.duplicate(asset.id)}
                onDownload={() => actions.download(asset.id, asset.name)}
                onShare={() => actions.share(asset.id, asset.name)}
                onDelete={() => actions.remove(asset.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ActionCard({
  href,
  emoji,
  title,
  description,
  accent,
}: {
  href: string;
  emoji: string;
  title: string;
  description: string;
  accent: string;
}) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-2xl border border-border bg-surface p-6 transition-all hover:-translate-y-0.5 hover:border-white/25"
    >
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accent}`} />
      <div className="relative flex flex-col items-center gap-3 text-center">
        <span className="text-4xl">{emoji}</span>
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-xs text-muted">{description}</p>
      </div>
    </Link>
  );
}
