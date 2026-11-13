import { promises as fs } from "node:fs";
import { resolve, dirname } from "node:path";
import { IntentError, ErrorCodes } from "./error.js";

export async function writeAtomic(targetPath: string, data: string): Promise<void> {
  const tmpDir = resolve(dirname(targetPath), "..", "tmp");
  await fs.mkdir(tmpDir, { recursive: true });
  const tmpName = `${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`;
  const tmpPath = resolve(tmpDir, tmpName);

  // Symlink protection: lstat every path component of tmpDir
  let current = tmpDir;
  while (current !== dirname(current)) {
    try {
      const st = await fs.lstat(current);
      if (st.isSymbolicLink()) throw new IntentError(ErrorCodes.E_IO, "Symlink not allowed in path");
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        if (e instanceof IntentError) throw e;
      }
    }
    current = dirname(current);
  }

  const fh = await fs.open(tmpPath, "w", 0o600);
  try {
    await fh.writeFile(data, "utf-8");
    await fh.sync();
  } finally {
    await fh.close();
  }

  const delays = [20, 40, 80, 160, 320];
  for (let i = 0; i <= delays.length; i++) {
    try {
      await fs.rename(tmpPath, targetPath);
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if ((code === "EPERM" || code === "EBUSY" || code === "EACCES") && i < delays.length) {
        await new Promise((r) => setTimeout(r, delays[i]));
        continue;
      }
      try { await fs.unlink(tmpPath); } catch { /* ignore cleanup errors */ }
      throw new IntentError(ErrorCodes.E_IO, `Atomic write failed: ${code}`);
    }
  }
}
