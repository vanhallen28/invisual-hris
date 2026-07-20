// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import PwaSetup from "@/components/PwaSetup";
import PwaSplash from "@/components/PwaSplash";
import ChatToaster from "@/components/ChatToaster";
import GlobalSearch from "@/components/GlobalSearch";

const inter = Inter({ subsets: ["latin"] });

// Font identitas INVISUAL (Inviline). Dipakai untuk judul & angka besar —
// bukan untuk teks kecil/tabel, karena angkanya tidak sama lebar.
const archaManic = localFont({
  src: [
    { path: "./fonts/ArchaManic-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ArchaManic-Bold.woff2", weight: "700", style: "normal" },
    { path: "./fonts/ArchaManic-Black.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-archa",
  display: "swap",
});

// Aksen ukuran besar (layar login, sampul laporan, keadaan kosong).
const pasteur = localFont({
  src: [{ path: "./fonts/Pasteur.woff2", weight: "400", style: "normal" }],
  variable: "--font-pasteur",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "Invisual Portal - HR System",
  description: "Sistem Absensi dan Manajemen HR Invisual Studio",
  manifest: "/manifest.json",
  icons: { icon: "/logo.png", apple: "/icon-192.png" },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Invisual HR" },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${archaManic.variable} ${pasteur.variable}`}>
      <body className={`${inter.className} bg-[#0a0a0a] text-white antialiased`} suppressHydrationWarning>
        <PwaSetup />
        <PwaSplash />
        {children}
        <ChatToaster />
        <GlobalSearch />
      </body>
    </html>
  );
}
