"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  UploadCloud,
  Search,
  LayoutGrid,
  List,
  Eye,
  Download,
  Trash2,
  Loader2,
  FolderOpen,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { FilePreviewModal } from "@/components/corporate/FilePreviewModal";
import { CategoryBadge } from "@/components/corporate/CategoryBadge";
import {
  formatBytes,
  relativeTime,
  fileKind,
  isPreviewable,
  initialsOf,
  cn,
} from "@/lib/corporate/utils";
import type { Category, FileWithRelations } from "@/lib/corporate/types";
import { useToast } from "@/components/Toast";

export function VaultView() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<FileWithRelations[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [view, setView] = useState<"grid" | "list">("grid");

  const [uploadCategory, setUploadCategory] = useState<string>("none");
  const [uploading, setUploading] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const [previewFile, setPreviewFile] = useState<FileWithRelations | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [filesRes, catsRes] = await Promise.all([
      supabase
        .from("files")
        .select("*, category:categories(*), uploader:members(id, name, email)")
        .order("created_at", { ascending: false }),
      supabase.from("categories").select("*").eq("type", "file").order("name"),
    ]);
    setFiles((filesRes.data ?? []) as unknown as FileWithRelations[]);
    setCategories((catsRes.data ?? []) as Category[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = searchParams.get("id");
    if (id && files.length) {
      const f = files.find((x) => x.id === id);
      if (f) setPreviewFile(f);
    }
  }, [searchParams, files]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    files.forEach((f) => {
      const key = f.category_id ?? "uncategorized";
      map[key] = (map[key] ?? 0) + 1;
    });
    return map;
  }, [files]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return files.filter((f) => {
      if (activeCategory !== "all") {
        if (
          activeCategory === "uncategorized"
            ? f.category_id !== null
            : f.category_id !== activeCategory
        )
          return false;
      }
      if (q) {
        const hay = `${f.file_name} ${f.description ?? ""} ${f.tags.join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [files, query, activeCategory]);

  // ---- Upload -------------------------------------------------------------
  const uploadFiles = async (list: FileList | File[]) => {
    const arr = Array.from(list);
    if (!arr.length) return;

    for (const file of arr) {
      setUploading((u) => [...u, file.name]);
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${crypto.randomUUID()}-${safeName}`;

      const { error: upErr } = await supabase.storage
        .from("vault-files")
        .upload(path, file, { cacheControl: "3600", upsert: false });

      if (!upErr) {
        await supabase.from("files").insert({
          file_name: file.name,
          storage_path: path,
          file_size: file.size,
          file_type: file.type || "application/octet-stream",
          category_id: uploadCategory === "none" ? null : uploadCategory,
          tags: [],
        });
      }
      setUploading((u) => u.filter((n) => n !== file.name));
    }
    await load();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
  };

  const downloadFile = async (f: FileWithRelations) => {
    const { data } = await supabase.storage
      .from("vault-files")
      .createSignedUrl(f.storage_path, 60, { download: f.file_name });
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const deleteFile = async (f: FileWithRelations) => {
    if (!(await toast.konfirmasi(`Hapus "${f.file_name}"?`, { labelYa: "Hapus" }))) return;
    await supabase.storage.from("vault-files").remove([f.storage_path]);
    await supabase.from("files").delete().eq("id", f.id);
    setFiles((prev) => prev.filter((x) => x.id !== f.id));
  };

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Dokumen</h1>
        <p className="mt-1 text-sm text-gray-400">
          Unggah, kelola, dan pratinjau dokumen perusahaan.
        </p>
      </div>

      {/* Bar kategori (horizontal) */}
      <div className="mb-5 flex flex-wrap items-center gap-1.5">
        <Chip
          active={activeCategory === "all"}
          onClick={() => setActiveCategory("all")}
          label="Semua file"
          count={files.length}
        />
        {categories.map((c) => (
          <Chip
            key={c.id}
            active={activeCategory === c.id}
            onClick={() => setActiveCategory(c.id)}
            label={c.name}
            count={counts[c.id] ?? 0}
            color={c.color}
          />
        ))}
        <Chip
          active={activeCategory === "uncategorized"}
          onClick={() => setActiveCategory("uncategorized")}
          label="Tanpa kategori"
          count={counts["uncategorized"] ?? 0}
        />
      </div>

      {/* Uploader */}
      <div className="mb-5 p-4 relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 kartu-glow">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Unggah ke kategori:
          </span>
          <select
            value={uploadCategory}
            onChange={(e) => setUploadCategory(e.target.value)}
            className="h-8 rounded-lg border border-white/10 bg-input px-2 text-sm text-white outline-none focus:border-primer [color-scheme:dark]"
          >
            <option value="none">Tanpa kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors",
            dragOver
              ? "border-primer bg-primer/5"
              : "border-white/15 hover:border-white/30 hover:bg-white/5",
          )}
        >
          <UploadCloud className="h-8 w-8 text-gray-500" />
          <div className="text-sm font-medium text-gray-200">
            Tarik &amp; lepas file di sini, atau <span className="text-tint">pilih file</span>
          </div>
          <div className="font-mono text-xs text-gray-500">
            PDF, gambar, dokumen — tersimpan aman dengan akses ber-signed URL
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            onChange={(e) => e.target.files && uploadFiles(e.target.files)}
          />
        </div>

        {uploading.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {uploading.map((name) => (
              <div
                key={name}
                className="flex items-center gap-2 rounded-md bg-white/5 px-3 py-1.5 text-xs text-gray-300"
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin text-tint" />
                <span className="truncate">Mengunggah {name}…</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama file, tags…"
            className="h-9 w-full rounded-lg border border-white/10 bg-input pl-9 pr-3 text-sm text-white placeholder-gray-500 outline-none focus:border-primer"
          />
        </div>
        <div className="flex overflow-hidden rounded-lg border border-white/10">
          <button
            onClick={() => setView("grid")}
            className={cn(
              "grid h-9 w-9 place-items-center",
              view === "grid" ? "bg-primer text-white" : "text-gray-400 hover:bg-white/5",
            )}
            aria-label="Tampilan grid"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setView("list")}
            className={cn(
              "grid h-9 w-9 place-items-center",
              view === "list" ? "bg-primer text-white" : "text-gray-400 hover:bg-white/5",
            )}
            aria-label="Tampilan list"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <GridSkeleton />
      ) : filtered.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed border-white/15 py-20 text-center">
          <div className="text-gray-500">
            <FolderOpen className="mx-auto mb-3 h-10 w-10 opacity-40" />
            <div className="text-sm font-medium text-gray-200">Belum ada file</div>
            <div className="mt-1 text-xs">
              {query ? "Coba hapus filter pencarian." : "Unggah file di atas untuk memulai."}
            </div>
          </div>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((f) => (
            <FileCard
              key={f.id}
              file={f}
              onPreview={() => setPreviewFile(f)}
              onDownload={() => downloadFile(f)}
              onDelete={() => deleteFile(f)}
            />
          ))}
        </div>
      ) : (
        <FileTable
          files={filtered}
          onPreview={setPreviewFile}
          onDownload={downloadFile}
          onDelete={deleteFile}
        />
      )}

      <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
    </div>
  );
}

/* ------------------------------ subcomponents ----------------------------- */

function Chip({
  active,
  onClick,
  label,
  count,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-primer bg-primer/10 text-tint"
          : "border-white/10 text-gray-400 hover:text-white",
      )}
    >
      {color && (
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      )}
      {label}
      <span className="font-mono text-[11px] opacity-70">{count}</span>
    </button>
  );
}

function FileGlyph({ kind, large }: { kind: ReturnType<typeof fileKind>; large?: boolean }) {
  const map: Record<string, { label: string; className: string }> = {
    pdf: { label: "PDF", className: "bg-red-500/10 text-red-400" },
    image: { label: "IMG", className: "bg-violet-500/10 text-violet-400" },
    doc: { label: "DOC", className: "bg-blue-500/10 text-blue-400" },
    sheet: { label: "XLS", className: "bg-emerald-500/10 text-emerald-400" },
    other: { label: "FILE", className: "bg-white/5 text-gray-400" },
  };
  const g = map[kind];
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-lg font-mono font-semibold",
        large ? "h-12 w-12 text-xs" : "h-9 w-9 text-[10px]",
        g.className,
      )}
    >
      {g.label}
    </span>
  );
}

function FileCard({
  file,
  onPreview,
  onDownload,
  onDelete,
}: {
  file: FileWithRelations;
  onPreview: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  const kind = fileKind(file.file_type);
  const uploaderName = file.uploader?.name ?? file.uploader?.email ?? null;
  return (
    <div className="group flex flex-col p-4 transition-colors hover:border-white/20 relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition-all duration-300 hover:-translate-y-0.5 kartu-glow">
      <div className="flex items-start gap-3">
        <FileGlyph kind={kind} large />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-gray-100" title={file.file_name}>
            {file.file_name}
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-gray-500">
            {formatBytes(file.file_size)} · {relativeTime(file.created_at)}
          </div>
        </div>
      </div>

      <div className="mt-3">
        <CategoryBadge category={file.category} />
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
        {uploaderName ? (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-white/5 font-mono text-[9px] font-semibold">
              {initialsOf(uploaderName)}
            </span>
            <span className="max-w-[8rem] truncate">{uploaderName}</span>
          </div>
        ) : (
          <span className="text-[11px] text-gray-600">—</span>
        )}
        <div className="flex items-center gap-1">
          {isPreviewable(file.file_type) && (
            <IconBtn onClick={onPreview} label="Pratinjau">
              <Eye className="h-4 w-4" />
            </IconBtn>
          )}
          <IconBtn onClick={onDownload} label="Unduh">
            <Download className="h-4 w-4" />
          </IconBtn>
          <IconBtn onClick={onDelete} label="Hapus" danger>
            <Trash2 className="h-4 w-4" />
          </IconBtn>
        </div>
      </div>
    </div>
  );
}

function FileTable({
  files,
  onPreview,
  onDownload,
  onDelete,
}: {
  files: FileWithRelations[];
  onPreview: (f: FileWithRelations) => void;
  onDownload: (f: FileWithRelations) => void;
  onDelete: (f: FileWithRelations) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left font-mono text-[11px] uppercase tracking-wide text-gray-500">
            <th className="px-4 py-2.5 font-medium">Nama</th>
            <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Kategori</th>
            <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Ukuran</th>
            <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Diunggah</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {files.map((f) => (
            <tr key={f.id} className="hover:bg-white/5">
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  <FileGlyph kind={fileKind(f.file_type)} />
                  <span className="truncate font-medium text-gray-100">{f.file_name}</span>
                </div>
              </td>
              <td className="hidden px-4 py-2.5 sm:table-cell">
                <CategoryBadge category={f.category} />
              </td>
              <td className="hidden px-4 py-2.5 font-mono text-xs text-gray-500 lg:table-cell">
                {formatBytes(f.file_size)}
              </td>
              <td className="hidden px-4 py-2.5 font-mono text-xs text-gray-500 lg:table-cell">
                {relativeTime(f.created_at)}
              </td>
              <td className="px-4 py-2.5">
                <div className="flex items-center justify-end gap-1">
                  {isPreviewable(f.file_type) && (
                    <IconBtn onClick={() => onPreview(f)} label="Pratinjau">
                      <Eye className="h-4 w-4" />
                    </IconBtn>
                  )}
                  <IconBtn onClick={() => onDownload(f)} label="Unduh">
                    <Download className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn onClick={() => onDelete(f)} label="Hapus" danger>
                    <Trash2 className="h-4 w-4" />
                  </IconBtn>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  label,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "grid h-8 w-8 place-items-center rounded-md text-gray-400 transition-colors hover:bg-white/10",
        danger ? "hover:text-red-400" : "hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="p-4 relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 kartu-glow">
          <div className="flex gap-3">
            <div className="h-12 w-12 rounded-lg bg-white/5" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-4 w-3/4 rounded bg-white/5" />
              <div className="h-3 w-1/2 rounded bg-white/5" />
            </div>
          </div>
          <div className="mt-4 h-6 w-full rounded bg-white/5" />
        </div>
      ))}
    </div>
  );
}
