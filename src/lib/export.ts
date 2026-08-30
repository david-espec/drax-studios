import { fetchFile } from "@ffmpeg/util";
import { getFFmpeg } from "./ffmpeg";
import { withBasePath } from "./base-path";
import { RESOLUTION_DIMENSIONS } from "./types";
import type {
  ClipSegment,
  EditorProject,
  Fps,
  Overlay,
  Resolution,
  VideoFormat,
} from "./types";
import { getVideo } from "./db";

export interface ExportOptions {
  resolution: Resolution;
  fps: Fps;
  format: VideoFormat;
}

const WEBM_BITRATE_BPS: Record<Resolution, number> = {
  "720p": 2_000_000,
  "1080p": 4_000_000,
  "1440p": 7_000_000,
  "4k": 14_000_000,
};

export interface ExportProgress {
  ratio: number; // 0-1
  stage: string;
}

let fontLoaded = false;

function escapeDrawtext(text: string): string {
  return text
    .replace(/\\/g, "\\\\\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "’")
    .replace(/%/g, "\\%");
}

function filterPresetChain(preset: ClipSegment["filter"]): string | null {
  switch (preset) {
    case "none":
      return null;
    case "vivid":
      return "eq=saturation=1.6:contrast=1.15";
    case "grayscale":
      return "hue=s=0";
    case "warm":
      return "colorbalance=rs=0.15:gs=0.03:bs=-0.15";
    case "cool":
      return "colorbalance=rs=-0.15:gs=0.0:bs=0.15";
    case "cinematic":
      return "eq=contrast=1.15:saturation=0.8:brightness=-0.02";
  }
}

function transposeChain(rotation: ClipSegment["rotation"]): string | null {
  switch (rotation) {
    case 0:
      return null;
    case 90:
      return "transpose=1";
    case 180:
      return "transpose=1,transpose=1";
    case 270:
      return "transpose=2";
  }
}

/** atempo only accepts 0.5–2.0, so factors outside that range are chained across multiple atempo stages. */
function atempoChain(speed: number): string {
  const stages: number[] = [];
  let remaining = speed;
  while (remaining > 2.0) {
    stages.push(2.0);
    remaining /= 2.0;
  }
  while (remaining < 0.5) {
    stages.push(0.5);
    remaining /= 0.5;
  }
  stages.push(remaining);
  return stages.map((s) => `atempo=${s.toFixed(4)}`).join(",");
}

export async function exportProject(
  project: EditorProject,
  options: ExportOptions,
  onProgress?: (p: ExportProgress) => void
): Promise<Blob> {
  onProgress?.({ ratio: 0.02, stage: "Carregando motor de exportação" });
  const ffmpeg = await getFFmpeg();

  if (!fontLoaded) {
    try {
      const fontData = await fetchFile(withBasePath("/fonts/Inter-Bold.ttf"));
      await ffmpeg.writeFile("inter.ttf", fontData);
      fontLoaded = true;
    } catch {
      fontLoaded = false;
    }
  }

  ffmpeg.on("progress", ({ progress }) => {
    if (progress >= 0 && progress <= 1) {
      onProgress?.({ ratio: 0.1 + progress * 0.85, stage: "Processando vídeo" });
    }
  });

  const { width, height } = RESOLUTION_DIMENSIONS[options.resolution];

  onProgress?.({ ratio: 0.05, stage: "Carregando arquivos de origem" });

  const sourceCache = new Map<string, string>(); // assetId -> ffmpeg fs filename
  const clips = project.clips;

  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    if (sourceCache.has(clip.sourceAssetId)) continue;
    const asset = await getVideo(clip.sourceAssetId);
    if (!asset) throw new Error(`Fonte de vídeo não encontrada: ${clip.sourceAssetId}`);
    const ext = asset.mimeType.includes("mp4") ? "mp4" : "webm";
    const filename = `src_${sourceCache.size}.${ext}`;
    await ffmpeg.writeFile(filename, await fetchFile(asset.blob));
    sourceCache.set(clip.sourceAssetId, filename);
  }

  let replacedAudioFilename: string | null = null;
  if (project.replacedAudioAssetId) {
    const asset = await getVideo(project.replacedAudioAssetId);
    if (asset) {
      const ext = asset.mimeType.includes("mp4") ? "mp4" : "webm";
      replacedAudioFilename = `replacedaudio.${ext}`;
      await ffmpeg.writeFile(replacedAudioFilename, await fetchFile(asset.blob));
    }
  }

  let musicFilename: string | null = null;
  if (project.musicTrack) {
    const asset = await getVideo(project.musicTrack.assetId);
    if (asset) {
      const ext = asset.mimeType.includes("mp4") ? "mp4" : asset.mimeType.includes("webm") ? "webm" : "mp3";
      musicFilename = `music.${ext}`;
      await ffmpeg.writeFile(musicFilename, await fetchFile(asset.blob));
    }
  }

  const args: string[] = [];
  const inputIndexByClip: number[] = [];
  let inputCursor = 0;

  clips.forEach((clip) => {
    const filename = sourceCache.get(clip.sourceAssetId)!;
    args.push("-i", filename);
    inputIndexByClip.push(inputCursor);
    inputCursor++;
  });

  const replacedAudioInputIndex = replacedAudioFilename ? inputCursor++ : -1;
  if (replacedAudioFilename) args.push("-i", replacedAudioFilename);

  const musicInputIndex = musicFilename ? inputCursor++ : -1;
  if (musicFilename) args.push("-i", musicFilename);

  const filterParts: string[] = [];
  const concatVideoLabels: string[] = [];
  const concatAudioLabels: string[] = [];

  clips.forEach((clip, i) => {
    const idx = inputIndexByClip[i];
    const vChain: string[] = [
      `[${idx}:v]trim=start=${clip.inPoint}:end=${clip.outPoint},setpts=PTS-STARTPTS`,
    ];
    if (clip.speed !== 1) vChain.push(`setpts=${(1 / clip.speed).toFixed(4)}*PTS`);
    const rot = transposeChain(clip.rotation);
    if (rot) vChain.push(rot);
    const preset = filterPresetChain(clip.filter);
    if (preset) vChain.push(preset);
    vChain.push(
      `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
      `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black`,
      `setsar=1`
    );
    const vLabel = `v${i}out`;
    filterParts.push(`${vChain.join(",")}[${vLabel}]`);
    concatVideoLabels.push(vLabel);

    const aChain: string[] = [
      `[${idx}:a]atrim=start=${clip.inPoint}:end=${clip.outPoint},asetpts=PTS-STARTPTS`,
    ];
    if (clip.speed !== 1) aChain.push(atempoChain(clip.speed));
    aChain.push(`volume=${clip.muted ? 0 : clip.volume}`);
    const aLabel = `a${i}out`;
    filterParts.push(`${aChain.join(",")}[${aLabel}]`);
    concatAudioLabels.push(aLabel);
  });

  const concatInputs = clips
    .map((_, i) => `[${concatVideoLabels[i]}][${concatAudioLabels[i]}]`)
    .join("");
  filterParts.push(`${concatInputs}concat=n=${clips.length}:v=1:a=1[vcat][acat0]`);

  let videoLabel = "vcat";
  const overlays: Overlay[] = project.overlays ?? [];
  overlays.forEach((ov, i) => {
    const inLabel = videoLabel;
    const outLabel = `vov${i}`;
    const enable = `enable='between(t,${ov.start},${ov.end})'`;
    if (ov.kind === "text") {
      const escaped = escapeDrawtext(ov.text);
      const fontOpt = fontLoaded ? "fontfile=inter.ttf:" : "";
      filterParts.push(
        `[${inLabel}]drawtext=${fontOpt}text='${escaped}':x=${ov.x}*w:y=${ov.y}*h:fontsize=${ov.fontSize}:fontcolor=${ov.color.replace(
          "#",
          "0x"
        )}:${enable}[${outLabel}]`
      );
    } else if (ov.kind === "shape") {
      // ffmpeg's drawbox draws rectangles only; a circle shape is approximated by its bounding box.
      filterParts.push(
        `[${inLabel}]drawbox=x=${ov.x}*w:y=${ov.y}*h:w=${ov.width}*w:h=${ov.height}*h:color=${ov.color.replace(
          "#",
          "0x"
        )}@0.6:t=fill:${enable}[${outLabel}]`
      );
    } else {
      filterParts.push(`[${inLabel}]null[${outLabel}]`);
    }
    videoLabel = outLabel;
  });

  let audioLabel = "acat0";

  if (replacedAudioFilename && replacedAudioInputIndex >= 0) {
    filterParts.push(`[${replacedAudioInputIndex}:a]anull[areplaced]`);
    audioLabel = "areplaced";
  }

  if (musicFilename && musicInputIndex >= 0) {
    const musicVol = project.musicTrack?.volume ?? 0.5;
    filterParts.push(`[${musicInputIndex}:a]volume=${musicVol}[amusic]`);
    filterParts.push(`[${audioLabel}][amusic]amix=inputs=2:duration=first:weights=1 1[amixed]`);
    audioLabel = "amixed";
  }

  args.push("-filter_complex", filterParts.join(";"));
  args.push("-map", `[${videoLabel}]`, "-map", `[${audioLabel}]`);
  args.push("-r", String(options.fps));

  const outName = options.format === "mp4" ? "output.mp4" : "output.webm";
  if (options.format === "mp4") {
    args.push(
      "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-movflags", "+faststart"
    );
  } else {
    // libvpx-vp9 is prohibitively slow (and unstable) in this single-threaded
    // wasm build; VP8 with a realtime deadline is the encoder that actually works.
    args.push(
      "-c:v", "libvpx", "-b:v", String(WEBM_BITRATE_BPS[options.resolution]),
      "-deadline", "realtime", "-cpu-used", "8",
      "-c:a", "libvorbis"
    );
  }
  args.push(outName);

  onProgress?.({ ratio: 0.1, stage: "Renderizando" });
  await ffmpeg.exec(args);

  onProgress?.({ ratio: 0.97, stage: "Finalizando arquivo" });
  const data = await ffmpeg.readFile(outName);
  const blob = new Blob([data as unknown as BlobPart], {
    type: options.format === "mp4" ? "video/mp4" : "video/webm",
  });

  await ffmpeg.deleteFile(outName);
  onProgress?.({ ratio: 1, stage: "Concluído" });
  return blob;
}

export async function generateThumbnail(videoBlob: Blob, atSeconds = 0.5): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.src = URL.createObjectURL(videoBlob);
    video.addEventListener("loadedmetadata", () => {
      video.currentTime = Math.min(atSeconds, Math.max(0, video.duration - 0.1));
    });
    video.addEventListener("seeked", () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 360;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas indisponível"));
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(video.src);
        if (blob) resolve(blob);
        else reject(new Error("Falha ao gerar thumbnail"));
      }, "image/jpeg", 0.8);
    });
    video.addEventListener("error", () => reject(new Error("Falha ao carregar vídeo para thumbnail")));
  });
}

export async function getVideoMetadata(blob: Blob): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.src = URL.createObjectURL(blob);

    const finish = (duration: number) => {
      resolve({ duration, width: video.videoWidth, height: video.videoHeight });
      URL.revokeObjectURL(video.src);
    };

    video.addEventListener("loadedmetadata", () => {
      if (Number.isFinite(video.duration)) {
        finish(video.duration);
        return;
      }
      // MediaRecorder output often reports duration=Infinity until the browser is
      // forced to seek near the end, a well-known webm/MediaRecorder quirk.
      const onTimeUpdate = () => {
        video.removeEventListener("timeupdate", onTimeUpdate);
        const fixedDuration = Number.isFinite(video.duration) ? video.duration : video.currentTime;
        video.currentTime = 0;
        finish(fixedDuration);
      };
      video.addEventListener("timeupdate", onTimeUpdate);
      video.currentTime = 1e9;
    });
    video.addEventListener("error", () => {
      const code = video.error?.code;
      const message = video.error?.message;
      reject(new Error(`Falha ao ler metadados do vídeo (code=${code}, message=${message})`));
    });
  });
}
