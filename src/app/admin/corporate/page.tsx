import { redirect } from "next/navigation";

// Sementara mengarah ke Dokumen. Akan diganti dengan Dashboard di langkah akhir.
export default function CorporateIndex() {
  redirect("/admin/corporate/dokumen");
}
