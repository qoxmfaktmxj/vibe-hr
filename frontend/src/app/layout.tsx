import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Inter } from "next/font/google";

import { Providers } from "@/components/providers";
import type { AuthUser } from "@/types/auth";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vibe-HR",
  description: "Vibe-HR MVP with Next.js + FastAPI + SQLModel",
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialUser = await getInitialAuthUser();

  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        <Providers initialUser={initialUser}>{children}</Providers>
      </body>
    </html>
  );
}
