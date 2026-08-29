"use client";

import { Play, Pause } from "lucide-react";
import type { RefObject } from "react";
import type { Overlay } from "@/lib/types";

export function PreviewStage({
  videoRef,
  overlays,
  playhead,
  isPlaying,
  onTogglePlay,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  overlays: Overlay[];
  playhead: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
}) {
  const visibleOverlays = overlays.filter((o) => playhead >= o.start && playhead <= o.end);

  return (
    <div className="relative mx-auto flex aspect-video w-full max-w-3xl items-center justify-center overflow-hidden rounded-2xl bg-black">
      <video ref={videoRef} className="h-full w-full object-contain" playsInline />

      {visibleOverlays.map((overlay) => (
        <OverlayRenderer key={overlay.id} overlay={overlay} />
      ))}

      <button
        onClick={onTogglePlay}
        className="absolute bottom-3 left-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"
      >
        {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5 fill-white" />}
      </button>
    </div>
  );
}

function OverlayRenderer({ overlay }: { overlay: Overlay }) {
  const style: React.CSSProperties = {
    position: "absolute",
    left: `${overlay.x * 100}%`,
    top: `${overlay.y * 100}%`,
    pointerEvents: "none",
  };

  if (overlay.kind === "text") {
    return (
      <span
        style={{
          ...style,
          color: overlay.color,
          fontSize: overlay.fontSize,
          fontWeight: 700,
          textShadow: "0 1px 4px rgba(0,0,0,0.8)",
          transform: "translate(-50%, -50%)",
          whiteSpace: "pre-wrap",
          maxWidth: "90%",
          textAlign: "center",
        }}
      >
        {overlay.text}
      </span>
    );
  }

  if (overlay.kind === "shape") {
    return (
      <div
        style={{
          ...style,
          width: `${overlay.width * 100}%`,
          height: `${overlay.height * 100}%`,
          backgroundColor: overlay.shape === "rectangle" ? `${overlay.color}99` : "transparent",
          border: overlay.shape === "circle" ? `4px solid ${overlay.color}` : "none",
          borderRadius: overlay.shape === "circle" ? "50%" : 6,
        }}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={overlay.imageDataUrl}
      alt=""
      style={{
        ...style,
        width: `${overlay.width * 100}%`,
        height: `${overlay.height * 100}%`,
        objectFit: "contain",
      }}
    />
  );
}
