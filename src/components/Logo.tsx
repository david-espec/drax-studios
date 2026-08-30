import Image from "next/image";
import { withBasePath } from "@/lib/base-path";

export function Logo({ size = 32, showWordmark = false }: { size?: number; showWordmark?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="relative shrink-0 overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10"
        style={{ width: size, height: size }}
      >
        <Image
          src={withBasePath("/brand/logo.png")}
          alt="Drax Studio"
          fill
          sizes={`${size}px`}
          className="object-contain p-0.5"
          priority
        />
      </div>
      {showWordmark && (
        <span className="text-lg font-bold tracking-tight">
          DRAX <span className="brand-gradient-text">STUDIO</span>
        </span>
      )}
    </div>
  );
}
