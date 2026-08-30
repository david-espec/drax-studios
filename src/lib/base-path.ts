// Mirrors next.config.ts's basePath. next/image and next/link apply it
// automatically, but manual fetch()/script URLs (ffmpeg core, fonts) don't,
// so those call withBasePath() explicitly.
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") || "";

export function withBasePath(path: string): string {
  return `${BASE_PATH}${path}`;
}
