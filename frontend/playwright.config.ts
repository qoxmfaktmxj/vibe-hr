import { defineConfig } from "@playwright/test";
import { AUTH_STATE_PATH } from "./tests/e2e/global-setup";

const frontendUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const backendUrl = process.env.PLAYWRIGHT_API_URL ?? "http://127.0.0.1:8080";
const frontend = new URL(frontendUrl);
for (const url of [frontend, new URL(backendUrl)]) {
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
      || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Live workflow tests require isolated loopback services.");
  }
}
const authSecret = process.env.AUTH_TOKEN_SECRET ?? "";
const bffSecret = process.env.VIBEHR_BFF_ASSERTION_SECRET ?? "";
if (!/^[a-f0-9]{64}$/i.test(authSecret) || !/^[a-f0-9]{64}$/i.test(bffSecret) || authSecret === bffSecret) {
  throw new Error("Live workflow tests require the disposable backend's distinct temporary auth and BFF secrets.");
}

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  // 과거 사고: 기본 workers(코어 병렬)로 로그인 테스트 다수 동시 실행 시 dev 서버 과부하로 타임아웃 발생 -> 순차 실행 고정
  workers: 1,
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: frontendUrl,
    extraHTTPHeaders: { "x-vibehr-client-ip": "127.0.0.1" },
    contextOptions: { reducedMotion: "reduce" },
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    storageState: AUTH_STATE_PATH,
  },
  webServer: {
    command: `node node_modules/next/dist/bin/next dev --hostname ${frontend.hostname.replace(/[\[\]]/g, "")} --port ${frontend.port || "80"}`,
    url: `${frontend.origin}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      AUTH_TOKEN_SECRET: authSecret,
      VIBEHR_BFF_ASSERTION_SECRET: bffSecret,
      VIBEHR_BFF_BACKEND_URL: new URL(backendUrl).origin,
      VIBEHR_BFF_TRUSTED_CLIENT_IP_HEADER: "x-vibehr-client-ip",
      APP_ORIGIN: frontend.origin,
      NEXT_PUBLIC_APP_ORIGIN: frontend.origin,
    },
  },
});
