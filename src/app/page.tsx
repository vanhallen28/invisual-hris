// src/app/page.tsx
import { redirect } from "next/navigation";

export default function RootPage() {
  // Otomatis mengarahkan setiap pengunjung awal ke gerbang login
  redirect("/login");
}