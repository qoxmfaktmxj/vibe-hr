import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { Providers } from "@/components/providers";
import { getAuthUser, getMenuTree } from "@/lib/server/session";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vibe-HR",
  description: "Vibe-HR MVP with Next.js + FastAPI + SQLModel",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/site.webmanifest",
  other: {
    "msapplication-config": "/browserconfig.xml",
    "msapplication-TileColor": "#1C295E",
  },
  themeColor: "#1C295E",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [initialUser, initialMenus] = await Promise.all([getAuthUser(), getMenuTree()]);

  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        <Providers initialUser={initialUser} initialMenus={initialMenus}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
