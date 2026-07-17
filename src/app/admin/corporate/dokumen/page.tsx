import { Suspense } from "react";
import { VaultView } from "@/components/corporate/VaultView";

export default function DokumenPage() {
  return (
    <Suspense fallback={<div className="text-sm text-gray-500">Memuat…</div>}>
      <VaultView />
    </Suspense>
  );
}
