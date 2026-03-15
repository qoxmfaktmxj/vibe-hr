import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { Providers } from "@/components/providers";

import "./globals.css";

const DEFAULT_APP_ORIGIN = "http://localhost:3000";

function resolveMetadataBase(): URL {
  const appOrigin = process.env.APP_ORIGIN ?? process.env.NEXT_PUBLIC_APP_ORIGIN ?? DEFAULT_APP_ORIGIN;

  try {
    return new URL(appOrigin);
  } catch {
    return new URL(DEFAULT_APP_ORIGIN);
  }
}

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  title: "VIBE-HR",
  description: "VIBE-HR MVP with Next.js + FastAPI + SQLModel",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "VIBE-HR",
    description: "VIBE-HR MVP with Next.js + FastAPI + SQLModel",
    images: [{ url: "/vibe-hr-thumbnail.webp", width: 1200, height: 630, type: "image/webp" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "VIBE-HR",
    description: "VIBE-HR MVP with Next.js + FastAPI + SQLModel",
    images: ["/vibe-hr-thumbnail.webp"],
  },
  other: {
    "msapplication-config": "/browserconfig.xml",
    "msapplication-TileColor": "#3C6DEE",
  },
};

export const viewport: Viewport = {
  themeColor: "#3C6DEE",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${inter.variable} antialiased`}>
        <Providers initialUser={null} initialMenus={[]}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
