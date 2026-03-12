import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

const API_BASE_URL =
  process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const AUTH_COOKIE_NAME = "vibe_hr_token";

type BackendRequestOptions = {
  accessToken?: string | null;
  cache?: RequestCache;
  next?: NextFetchRequestConfig;
};

export const getServerAccessToken = cache(async (): Promise<string | null> => {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_COOKIE_NAME)?.value ?? null;
});

export async function fetchBackendJson<T>(
  path: string,
  options: BackendRequestOptions = {},
): Promise<T | null> {
  const accessToken = options.accessToken ?? (await getServerAccessToken());
  if (!accessToken) {
    return null;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: options.cache,
    next: options.next,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as T;
}
