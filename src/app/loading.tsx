// src/app/loading.tsx
import LoadingLogo from "@/components/LoadingLogo";

export default function RootLoading() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-latar animate-in fade-in duration-300">
      <LoadingLogo size={72} withRing text="Menyiapkan Ruang Kerja" />
    </div>
  );
}
