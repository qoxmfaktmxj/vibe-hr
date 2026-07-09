import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  // 과거 사고: 기본 workers(코어 병렬)로 로그인 테스트 다수 동시 실행 시 dev 서버 과부하로 타임아웃 발생 -> 순차 실행 고정
  workers: 1,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
