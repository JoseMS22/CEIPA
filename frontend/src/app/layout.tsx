// src/app/layout.tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// ⚙️ URL base del sitio (prod y dev)
// En producción: NEXT_PUBLIC_SITE_URL="https://tu-dominio.com"
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "CEIPA Riesgos Geopoliticos",
    template: "%s | CEIPA Riesgos Geopoliticos",
  },
  description: "Herramienta web para riesgos geopolíticos",
  icons: {
    icon: "/icon.png",      // 👉 favicon
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
  // (Opcional pero bueno para producción)
  openGraph: {
    title: "CEIPA Riesgos Geopoliticos",
    description: "Herramienta web para riesgos geopolíticos",
    url: siteUrl,
    siteName: "CEIPA Riesgos Geopoliticos",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "CEIPA Risk",
    description: "Herramienta web para riesgos geopolíticos",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
