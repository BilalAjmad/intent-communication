import { test, expect } from "@playwright/test";
import { promises as fs } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

test.describe("Tier 1 Smoke Test (S-1-14)", () => {
  const testDir = resolve(process.cwd(), ".test-smoke");
  const cliPath = resolve(process.cwd(), "packages", "cli", "dist", "cli.js");

  test.beforeAll(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
    }

    execSync(`node ${cliPath} init --path ${testDir}`, { stdio: "pipe", timeout: 30000 });
    execSync(`node ${cliPath} export --path ${testDir}`, { stdio: "pipe", timeout: 30000 });
  });

  test.afterAll(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
    }
  });

  test("init creates project structure", async () => {
    const intentDir = resolve(testDir, ".intent");
    const exists = await fs.access(intentDir).then(() => true).catch(() => false);
    expect(exists).toBe(true);

    const configPath = resolve(testDir, ".intent", "config.json");
    const configExists = await fs.access(configPath).then(() => true).catch(() => false);
    expect(configExists).toBe(true);

    const scenePath = resolve(testDir, ".intent", "scenes", "default.json");
    const sceneExists = await fs.access(scenePath).then(() => true).catch(() => false);
    expect(sceneExists).toBe(true);
  });

  test("doctor passes", async () => {
    const output = execSync(`node ${cliPath} doctor --path ${testDir}`, { encoding: "utf-8" });
    expect(output).toContain("All checks passed");
  });

  test("export produces valid HTML", async () => {
    const htmlPath = resolve(testDir, "export-default.html");
    const htmlExists = await fs.access(htmlPath).then(() => true).catch(() => false);
    expect(htmlExists).toBe(true);

    const html = await fs.readFile(htmlPath, "utf-8");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("</html>");
  });

  test("exported HTML has zero network requests", async ({ page }) => {
    const htmlPath = resolve(testDir, "export-default.html");
    const requests: string[] = [];
    page.on("request", (req) => requests.push(req.url()));

    await page.goto(`file://${htmlPath}`);
    await page.waitForTimeout(1000);

    const networkRequests = requests.filter((r) => !r.startsWith("file://"));
    expect(networkRequests.length).toBe(0);
  });

  test("exported HTML navigation works", async ({ page }) => {
    const htmlPath = resolve(testDir, "export-default.html");
    await page.goto(`file://${htmlPath}`);
    await expect(page.locator("body")).toBeVisible();
  });
});