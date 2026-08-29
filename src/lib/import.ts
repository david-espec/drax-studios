import { saveVideo } from "./db";
import { generateThumbnail, getVideoMetadata } from "./export";
import type { VideoAsset } from "./types";

export async function importMediaFile(file: File, source: VideoAsset["source"] = "import"): Promise<VideoAsset> {
  const meta = await getVideoMetadata(file).catch(() => ({ duration: 0, width: 0, height: 0 }));
  const thumbnailBlob = meta.width > 0 ? await generateThumbnail(file).catch(() => undefined) : undefined;
  const asset: VideoAsset = {
    id: crypto.randomUUID(),
    name: file.name.replace(/\.[^/.]+$/, ""),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    durationSec: meta.duration,
    width: meta.width,
    height: meta.height,
    sizeBytes: file.size,
    mimeType: file.type || "video/mp4",
    status: "ready",
    source,
    thumbnailBlob,
  };
  await saveVideo(asset, file);
  return asset;
}
