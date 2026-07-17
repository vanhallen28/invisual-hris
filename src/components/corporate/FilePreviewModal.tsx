"use client";

import { useEffect, useState } from "react";
import { X, Download, Loader2, FileWarning } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { CategoryBadge } from "@/components/corporate/CategoryBadge";
import { formatBytes, formatDate, fileKind, isPreviewable } from "@/lib/corporate/utils";
import type { FileWithRelations } from "@/lib/corporate/types";

/**
 * Pratinjau layar-penuh. PDF di-render lewat iframe, gambar inline — tanpa
 * perlu unduh. Selain itu jatuh ke aksi unduh. URL di-sign 5 menit agar bucket
 * privat tetap privat.
 */
export function FilePreviewModal({
  file,
  onClose,
}: {
  file: FileWithRelations | null;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!file) return;
    setLoading(true);
    setUrl(null);
    supabase.storage
      .from("vault-files")
      .createSignedUrl(file.storage_path, 300)
      .then(({ data }) => {
        setUrl(data?.signedUrl ?? null);
        setLoading(false);
      });
  }, [file]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!file) return null;

  const kind = fileKind(file.file_type);

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      {/* Header */}
      <div
        className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-[#0f0f0f] px-4 py-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-white">{file.file_name}</div>
          <div className="mt-0.5 flex items-center gap-2 font-mono text-[11px] text-gray-500">
            <span>{formatBytes(file.file_size)}</span>
            <span>·</span>
            <span>{file.file_type}</span>
            <span>·</span>
            <span>{formatDate(file.created_at)}</span>
          </div>
        </div>
        <CategoryBadge category={file.category} />
        {url && (
          <a
            href={url}
            download={file.file_name}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#124bce] px-3 py-1.5 text-xs font-bold text-white hover:opacity-90"
          >
            <Download className="h-3.5 w-3.5" /> Unduh
          </a>
        )}
        <button
          onClick={onClose}
          className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 hover:bg-white/10 hover:text-white"
          aria-label="Tutup pratinjau"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Body */}
      <div
        className="flex min-h-0 flex-1 items-center justify-center p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <Loader2 className="h-8 w-8 animate-spin text-white/70" />
        ) : !url ? (
          <FallbackNote text="Tautan pratinjau gagal dibuat." />
        ) : !isPreviewable(file.file_type) ? (
          <FallbackNote text="Tipe file ini tak bisa dipratinjau inline. Gunakan Unduh untuk membukanya." />
        ) : kind === "pdf" ? (
          <iframe
            src={url}
            title={file.file_name}
            className="h-full w-full max-w-5xl rounded-lg border border-white/10 bg-white"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={file.file_name}
            className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
          />
        )}
      </div>
    </div>
  );
}

function FallbackNote({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl bg-[#0f0f0f] border border-white/10 px-8 py-10 text-center">
      <FileWarning className="h-10 w-10 text-gray-500" />
      <p className="max-w-xs text-sm text-gray-400">{text}</p>
    </div>
  );
}
