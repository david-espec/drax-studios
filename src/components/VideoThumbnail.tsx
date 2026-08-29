"use client";

import { useEffect, useState } from "react";
import { Film } from "lucide-react";
import type { VideoAsset } from "@/lib/types";

export function VideoThumbnail({ asset, className }: { asset: VideoAsset; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!asset.thumbnailBlob) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(asset.thumbnailBlob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [asset.thumbnailBlob]);

  if (!url) {
    return (
      <div className={`flex items-center justify-center bg-surface-2 ${className ?? ""}`}>
        <Film size={28} className="text-muted" />
      </div>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={asset.name} className={`object-cover ${className ?? ""}`} />;
}
