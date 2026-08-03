import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import { Providers } from "@/components/providers";

import "./globals.css";

const DEFAULT_APP_ORIGIN = "http://localhost:3000";
const THEME_BOOTSTRAP = `(() => {
  try {
    const raw = localStorage.getItem("vibe_hr_theme_preferences");
    if (!raw) return;
    const preference = JSON.parse(raw);
    const root = document.documentElement;
    root.classList.toggle("dark", Boolean(preference.darkMode));
    root.dataset.palette = preference.paletteMode === "vivid" ? "vivid" : "default";
    root.dataset.primaryTone = ["blue", "skyblue", "gray", "green", "red"].includes(preference.primaryTone)
      ? preference.primaryTone
      : "blue";
  } catch {
    // 저장된 테마가 손상된 경우 기본 토큰을 사용합니다.
  }
})();`;

function resolveMetadataBase(): URL {
  const appOrigin = process.env.APP_ORIGIN ?? process.env.NEXT_PUBLIC_APP_ORIGIN ?? DEFAULT_APP_ORIGIN;

  try {
    return new URL(appOrigin);
  } catch {
    return new URL(DEFAULT_APP_ORIGIN);
  }
}

const pretendard = localFont({
  src: "../../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  display: "swap",
  variable: "--font-pretendard",
  weight: "100 900",
});

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  title: "VIBE-HR",
  description: "VIBE-HR MVP with Next.js + Spring Boot + JPA",
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
    description: "VIBE-HR MVP with Next.js + Spring Boot + JPA",
    images: [{ url: "/vibe-hr-thumbnail.webp", width: 1200, height: 630, type: "image/webp" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "VIBE-HR",
    description: "VIBE-HR MVP with Next.js + Spring Boot + JPA",
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
    <html lang="ko" className={pretendard.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="antialiased">
        <Providers initialUser={null} initialMenus={[]}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
