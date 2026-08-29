"use client";

import { useCallback, useEffect, useState } from "react";
import { listVideos } from "@/lib/db";
import type { VideoAsset } from "@/lib/types";

export function useVideos() {
  const [videos, setVideos] = useState<VideoAsset[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await listVideos();
    setVideos(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { videos, loading, refresh };
}
