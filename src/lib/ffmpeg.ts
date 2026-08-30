import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";
import { withBasePath } from "./base-path";

let ffmpegInstance: FFmpeg | null = null;
let loadingPromise: Promise<FFmpeg> | null = null;

const CORE_BASE_URL = withBasePath("/ffmpeg-core");

export async function getFFmpeg(onLog?: (message: string) => void): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const ffmpeg = new FFmpeg();
    if (onLog) {
      ffmpeg.on("log", ({ message }) => onLog(message));
    }
    const [coreURL, wasmURL] = await Promise.all([
      toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.js`, "text/javascript"),
      toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.wasm`, "application/wasm"),
    ]);
    await ffmpeg.load({ coreURL, wasmURL });
    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  return loadingPromise;
}
