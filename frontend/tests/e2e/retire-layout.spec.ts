import { expect, test } from "@playwright/test";

for (const width of [1440, 390]) {
  test(`retirement layout contains form and grid at ${width}px`, async ({ page, request }) => {
    const writes: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/hr/retire/") && request.method() !== "GET") writes.push(request.url());
    });
    await page.setViewportSize({ width, height: 900 });
    await request.post("http://127.0.0.1:3101/__scenario", { data: { scenario: "retire-layout" } });
    await page.goto("/login");
    await page.getByRole("button", { name: "로그인", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/hr/retire/approvals");
    await expect(page.getByRole("grid")).toContainText("TEST-001");
    await expect(page.getByRole("button", { name: "업로드", exact: true })).toHaveCount(0);
    await page.getByLabel("퇴직 대상자", { exact: true }).selectOption("1");
    await page.getByPlaceholder("사유(선택)", { exact: true }).fill("화면 확인");
    for (const control of [page.getByLabel("퇴직 대상자"), page.getByLabel("퇴직예정일"), page.getByPlaceholder("사유(선택)"), page.getByRole("button", { name: "퇴직 건 생성", exact: true })]) {
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await expect(page.getByRole("heading", { name: "퇴직 케이스 목록", exact: true })).toHaveCount(1);
    const title = await page.getByRole("heading", { name: "퇴직 케이스 목록", exact: true }).boundingBox();
    const grid = await page.getByRole("grid").boundingBox();
    expect(grid!.y - (title!.y + title!.height)).toBeLessThan(200);
    const headingBox = await page.getByText("퇴직 처리 생성", { exact: true }).boundingBox();
    expect(Math.abs(title!.x - headingBox!.x)).toBeLessThan(2);
    await page.getByRole("grid").getByText("TEST-001", { exact: true }).click();
    await expect(page.getByRole("button", { name: "퇴직 확정", exact: true })).toBeEnabled();
    await page.screenshot({ path: test.info().outputPath(`retire-${width}.png`), fullPage: true });
    expect(writes).toEqual([]);
    await page.goto("/tim/status");
    await expect(page.getByRole("grid")).toBeVisible();
    await expect(page.getByRole("button", { name: "업로드", exact: true })).toBeDisabled();
  });
}
