"use client";

import Link from "next/link";
import { Video, Scissors, FolderOpen, ArrowRight } from "lucide-react";
import { useVideos } from "@/hooks/useVideos";
import { useVideoActions } from "@/hooks/useVideoActions";
import { VideoListItem } from "@/components/VideoListItem";

export default function DashboardPage() {
  const { videos, loading, refresh } = useVideos();
  const actions = useVideoActions(refresh);
  const recent = videos.slice(0, 5);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-6 md:py-10">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent-red/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 right-10 h-40 w-40 rounded-full bg-accent-orange/20 blur-3xl" />
        <div className="relative max-w-sm">
          <h1 className="text-2xl font-bold sm:text-3xl">Grave. Edite. Crie.</h1>
          <p className="mt-2 text-sm text-muted">
            Tudo o que você precisa para transformar suas ideias em vídeos incríveis.
          </p>
          <div className="mt-4 h-1 w-10 rounded-full brand-gradient-bg" />
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold">O que você deseja fazer?</h2>
        <p className="mt-1 text-sm text-muted">Comece agora e dê vida às suas ideias.</p>

        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
          <ActionCard
            href="/gravar"
            icon={Video}
            title="Gravar Tela"
            description="Capture sua tela em alta qualidade."
            variant="red"
          />
          <ActionCard
            href="/editar"
            icon={Scissors}
            title="Editar Vídeo"
            description="Corte, ajuste e deixe do seu jeito."
            variant="blue"
          />
          <ActionCard
            href="/videos"
            icon={FolderOpen}
            title="Vídeos Prontos"
            description="Acesse seus vídeos gravados e editados."
            variant="purple"
          />
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Vídeos recentes</h2>
          {videos.length > 0 && (
            <Link href="/videos" className="flex items-center gap-0.5 text-sm text-accent-red hover:underline">
              Ver todos <ArrowRight size={14} />
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
          <div className="flex flex-col gap-2">
            {recent.map((asset) => (
              <VideoListItem
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

const VARIANT_STYLES = {
  red: {
    card: "bg-gradient-to-br from-accent-red to-accent-orange border-transparent text-white",
    iconWrap: "bg-white/20 text-white",
    arrow: "bg-white/20 text-white",
    desc: "text-white/80",
  },
  blue: {
    card: "bg-surface-2 border-border text-foreground",
    iconWrap: "bg-accent-blue/15 text-accent-blue",
    arrow: "border border-border text-foreground",
    desc: "text-muted",
  },
  purple: {
    card: "bg-surface-2 border-border text-foreground",
    iconWrap: "bg-accent-purple/15 text-accent-purple",
    arrow: "border border-border text-foreground",
    desc: "text-muted",
  },
} as const;

function ActionCard({
  href,
  icon: Icon,
  title,
  description,
  variant,
}: {
  href: string;
  icon: typeof Video;
  title: string;
  description: string;
  variant: keyof typeof VARIANT_STYLES;
}) {
  const styles = VARIANT_STYLES[variant];
  return (
    <Link
      href={href}
      className={`group flex flex-col justify-between rounded-2xl border p-3 transition-all hover:-translate-y-0.5 sm:p-5 ${styles.card}`}
    >
      <div>
        <div className={`mb-2.5 flex h-9 w-9 items-center justify-center rounded-full sm:mb-4 sm:h-11 sm:w-11 ${styles.iconWrap}`}>
          <Icon size={16} className="sm:hidden" />
          <Icon size={20} className="hidden sm:block" />
        </div>
        <h3 className="text-xs font-semibold sm:text-base">{title}</h3>
        <p className={`mt-1 text-[10px] leading-snug sm:text-xs ${styles.desc}`}>{description}</p>
      </div>
      <div
        className={`mt-2.5 flex h-6 w-6 items-center justify-center rounded-full transition-transform group-hover:translate-x-0.5 sm:mt-4 sm:h-8 sm:w-8 ${styles.arrow}`}
      >
        <ArrowRight size={12} className="sm:hidden" />
        <ArrowRight size={15} className="hidden sm:block" />
      </div>
    </Link>
  );
}
