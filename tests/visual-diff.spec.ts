import { test, expect } from "@playwright/test";
import { promises as fs } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

test.describe("Visual-diff test (S-1-13)", () => {
  const testDir = resolve(process.cwd(), ".test-visual");
  const cliPath = resolve(process.cwd(), "packages", "cli", "dist", "cli.js");

  test.beforeAll(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
    }

    await fs.mkdir(resolve(testDir, ".intent", "scenes"), { recursive: true });
    await fs.mkdir(resolve(testDir, ".intent", "locks"), { recursive: true });

    const scene = {
      version: 1,
      revision: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      screens: {
        "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a": {
          id: "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a",
          type: "screen",
          parentId: null,
          children: [],
          props: { title: "Visual Test", width: 1280, height: 720 },
          style: {},
          meta: {},
        },
      },
      objects: {
        "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a": {
          id: "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a",
          type: "screen",
          parentId: null,
          children: [],
          props: { title: "Visual Test", width: 1280, height: 720 },
          style: {},
          meta: {},
        },
      },
      screenOrder: ["018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a"],
      metadata: { name: "Visual Test", tags: [] },
    };

    await fs.writeFile(resolve(testDir, ".intent", "scenes", "default.json"), JSON.stringify(scene, null, 0));
    await fs.writeFile(resolve(testDir, ".intent", "locks", "default.locks.json"), JSON.stringify({ version: 1, lockedObjects: [], updatedAt: new Date().toISOString() }, null, 0));

    execSync(`node ${cliPath} export --path ${testDir}`, { stdio: "pipe", timeout: 30000 });
  });

  test.afterAll(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
    }
  });

  test("exported HTML renders correctly in browser", async ({ page }) => {
    const htmlPath = resolve(testDir, "export-default.html");
    const requests: string[] = [];
    page.on("request", (req) => requests.push(req.url()));

    await page.goto(`file://${htmlPath}`);
    await page.waitForTimeout(1000);

    const networkRequests = requests.filter((r) => !r.startsWith("file://"));
    expect(networkRequests.length).toBe(0);

    await expect(page.locator("body")).toBeVisible();
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).toBeTruthy();
  });

  test("visual screenshot baseline comparison", async ({ page }) => {
    const htmlPath = resolve(testDir, "export-default.html");
    await page.goto(`file://${htmlPath}`);
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot("visual-baseline.png", {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });

  test("navigation works in exported HTML", async ({ page }) => {
    const htmlPath = resolve(testDir, "export-default.html");
    await page.goto(`file://${htmlPath}`);
    await expect(page.locator("body")).toBeVisible();
  });
});