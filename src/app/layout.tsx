// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import PwaSetup from "@/components/PwaSetup";
import PwaSplash from "@/components/PwaSplash";

const inter = Inter({ subsets: ["latin"] });

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
    <html lang="id">
      <body className={`${inter.className} bg-[#0a0a0a] text-white antialiased`} suppressHydrationWarning>
        <PwaSetup />
        <PwaSplash />
        {children}
      </body>
    </html>
  );
}
