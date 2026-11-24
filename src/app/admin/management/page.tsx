// src/app/admin/management/page.tsx — section Management (lihat components/management/Management.tsx)
"use client";

import { Suspense } from "react";
import Management from "@/components/management/Management";

export default function HalamanManagement() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-sm text-gray-500">Memuat Management…</div>}>
      <Management portal="admin" />
    </Suspense>
  );
}
