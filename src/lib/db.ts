import { openDB, type IDBPDatabase } from "idb";
import type { VideoAsset, EditorProject } from "./types";

const DB_NAME = "drax-studio";
const DB_VERSION = 1;

interface StoredVideo extends VideoAsset {
  blob: Blob;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB only available in the browser");
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("videos")) {
          db.createObjectStore("videos", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("projects")) {
          db.createObjectStore("projects", { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

export async function saveVideo(asset: VideoAsset, blob: Blob) {
  const db = await getDb();
  const record: StoredVideo = { ...asset, blob };
  await db.put("videos", record);
}

export async function updateVideoMeta(id: string, patch: Partial<VideoAsset>) {
  const db = await getDb();
  const existing = (await db.get("videos", id)) as StoredVideo | undefined;
  if (!existing) return;
  await db.put("videos", { ...existing, ...patch, updatedAt: Date.now() });
}

export async function getVideo(id: string): Promise<(VideoAsset & { blob: Blob }) | undefined> {
  const db = await getDb();
  return (await db.get("videos", id)) as StoredVideo | undefined;
}

export async function listVideos(): Promise<VideoAsset[]> {
  const db = await getDb();
  const all = (await db.getAll("videos")) as StoredVideo[];
  return all
    .map((record) => {
      const meta: Partial<StoredVideo> = { ...record };
      delete meta.blob;
      return meta as VideoAsset;
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteVideo(id: string) {
  const db = await getDb();
  await db.delete("videos", id);
}

export async function duplicateVideo(id: string): Promise<VideoAsset | undefined> {
  const db = await getDb();
  const existing = (await db.get("videos", id)) as StoredVideo | undefined;
  if (!existing) return undefined;
  const clone: StoredVideo = {
    ...existing,
    id: crypto.randomUUID(),
    name: `${existing.name} (cópia)`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await db.put("videos", clone);
  const meta: Partial<StoredVideo> = { ...clone };
  delete meta.blob;
  return meta as VideoAsset;
}

export async function saveProject(project: EditorProject) {
  const db = await getDb();
  await db.put("projects", project);
}

export async function getProject(id: string): Promise<EditorProject | undefined> {
  const db = await getDb();
  return db.get("projects", id);
}
