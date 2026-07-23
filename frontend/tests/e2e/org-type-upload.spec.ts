import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

test("upload blocks invalid atomic confirmation and exposes the Korean error download state", async ({ page }) => {
  mkdirSync("output/playwright", { recursive: true });

  await page.goto("/org/type-upload");

  await expect(page.getByText("전체 행 원자성: 오류가 한 행이라도 있으면 저장하지 않습니다.")).toBeVisible();
  await expect(page.getByRole("button", { name: "오류 다운로드" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "확정 저장" })).toBeDisabled();
  await expect(page.locator(".ag-root")).toBeVisible();
  await page.screenshot({ path: "output/playwright/org-type-upload-ko.png", fullPage: true });
});
