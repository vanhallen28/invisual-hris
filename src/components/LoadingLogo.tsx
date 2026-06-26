// src/components/LoadingLogo.tsx
"use client";

import Image from "next/image";

interface LoadingLogoProps {
  /** Ukuran logo dalam pixel. Default 64 (untuk loading full page) */
  size?: number;
  /** Tampilkan teks di bawah logo */
  text?: string;
  /** Tampilkan ring glow berputar di sekeliling logo */
  withRing?: boolean;
}

export default function LoadingLogo({
  size = 64,
  text,
  withRing = false,
}: LoadingLogoProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        {/* Ring glow berputar di sekeliling logo (opsional) */}
        {withRing && (
          <div
            className="absolute inset-[-8px] rounded-full border-2 border-transparent border-t-[#2b5cd5] border-r-[#2b5cd5]/40 animate-spin"
            style={{ animationDuration: "1.2s" }}
          />
        )}

        {/* Logo yang berputar terus-menerus */}
        <div
          className="relative animate-spin"
          style={{ animationDuration: "1.8s" }}
        >
          <Image
            src="/logo.png"
            alt="Loading..."
            width={size}
            height={size}
            priority
            className="object-contain"
          />
        </div>
      </div>

      {text && (
        <p className="text-xs md:text-sm tracking-widest font-mono uppercase text-gray-400 animate-pulse">
          {text}
        </p>
      )}
    </div>
  );
}
