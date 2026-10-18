import type { Page } from "@playwright/test";
import { installLandingMediaReads } from "./landing-media-fixture";

type Item = Record<string, unknown>;
export async function installLandingMotionFixture(page: Page, id: string, scenario: string) {
  await installLandingMediaReads(page, id === "01" ? "employee-motion" : id, scenario);
  const reads = new Map<string, Item>();
  const changed = new Map<string, Item>();
  const writes: { path: string; method: string; body: unknown }[] = [];
  const editablePaths: Record<string, string> = {
    "01": "/api/employees/batch", "02": "/api/hr/basic/1/profile", "03": "/api/hr/basic/1/records/batch",
    "04": "/api/hri/requests/103/approve", "06": "/api/tim/schedules/departments", "08": "/api/tim/month-close",
    "14": "/api/wel/requests/1/approve", "15": "/api/tra/applications/101/approve", "16": "/api/pap/targets/batch", "17": "/api/menus/admin/roles/permissions",
  };
  const retained = new Set(["/api/tim/month-close", "/api/pap/targets", "/api/menus/admin/roles/permissions", "/api/wel/requests"]);
  page.on("response", async response => {
    const path = new URL(response.url()).pathname;
    if (retained.has(path) && response.request().method() === "GET" && response.ok()) reads.set(path, await response.json());
  });
  await page.route("**/api/**", async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname;
    if (req.method() === "GET") {
      if (changed.has(path)) return route.fulfill({ json: changed.get(path) });
      return route.fallback();
    }
    if (path !== editablePaths[id]) throw new Error(`Unexpected motion-fixture write: ${req.method()} ${path}`);
    const body = req.postData() ? req.postDataJSON() as Item : {};
    writes.push({ path, method: req.method(), body });
    if (id === "08") {
      const source = reads.get(path)!;
      const items = [...source.items as Item[]];
      const month = Number(body.month);
      const item = { ...(items.find(item => item.month === month) ?? {}), year: body.year, month, close_status: "closed", closed_by_name: "시연 담당자", closed_at: "2026-10-18T01:00:00Z", note: body.note ?? null };
      changed.set(path, { ...source, items: [...items.filter(item => item.month !== month), item] });
      return route.fulfill({ json: { item } });
    }
    if (id === "16") {
      const path = "/api/pap/targets", source = reads.get(path)!;
      const updates = body.items as Item[];
      const items = (source.items as Item[]).map(item => ({ ...item, ...updates.find(update => update.id === item.id) }));
      changed.set(path, { ...source, items });
      return route.fulfill({ json: { created: 0, updated: updates.length, deleted: 0 } });
    }
    if (id === "17") {
      changed.set(path, body);
      return route.fulfill({ json: body });
    }
    if (id === "14") {
      const path = "/api/wel/requests", source = reads.get(path)!;
      const items = (source.items as Item[]).map(item => ({ ...item, status_code: "approved", approved_amount: body.approved_amount }));
      changed.set(path, { ...source, items });
      return route.fulfill({ json: { item: items[0] } });
    }
    // These writes hit only the owned loopback synthetic service or the stateful grid fixture.
    return route.fallback();
  });
  return { writes };
}
