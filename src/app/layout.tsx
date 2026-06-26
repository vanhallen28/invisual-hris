// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import PwaSetup from "@/components/PwaSetup";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Invisual Portal - HR System",
  description: "Sistem Absensi dan Manajemen HR Invisual Studio",
  manifest: "/manifest.json",
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
    <html lang="id">
      <body className={`${inter.className} bg-[#0a0a0a] text-white antialiased`} suppressHydrationWarning>
        <PwaSetup /> {/* <-- LETAKKAN DI SINI (Sebelum children) */}
        {children}
      </body>
    </html>
  );
}
