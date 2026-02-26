import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Inter } from "next/font/google";

import { Providers } from "@/components/providers";
import type { AuthUser } from "@/types/auth";
import type { MenuNode, MenuTreeResponse } from "@/types/menu";

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

const API_BASE_URL =
  process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const AUTH_COOKIE_NAME = "vibe_hr_token";

async function getInitialAuthUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!accessToken) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as AuthUser;
  } catch {
    return null;
  }
}

async function getInitialMenus(): Promise<MenuNode[]> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!accessToken) {
    return [];
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/menus/tree`, {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as MenuTreeResponse;
    return data.menus;
  } catch {
    return [];
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [initialUser, initialMenus] = await Promise.all([
    getInitialAuthUser(),
    getInitialMenus(),
  ]);

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
