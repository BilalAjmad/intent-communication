import { promises as fs } from "node:fs";
import { resolve, dirname } from "node:path";
import { IntentError, ErrorCodes } from "./error.js";

export async function writeAtomic(targetPath: string, data: string): Promise<void> {
  // Temp file lives in the SAME directory as the target: rename() is then always
  // same-volume (atomic), and tmp files never escape the project (they used to land
  // in <projectRoot>/tmp for root-level targets).
  const tmpDir = dirname(targetPath);
  const tmpName = `${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`;
  const tmpPath = resolve(tmpDir, tmpName);

  // Symlink protection: the target's own directory must not be a symlink.
  try {
    const st = await fs.lstat(tmpDir);
    if (st.isSymbolicLink()) throw new IntentError(ErrorCodes.E_IO, "Symlink not allowed in path");
  } catch (e) {
    if (e instanceof IntentError) throw e;
    const code = (e as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw e;
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
      // Best-effort directory fsync so the rename itself is durable.
      try {
        const dirFh = await fs.open(tmpDir, "r");
        await dirFh.sync();
        await dirFh.close();
      } catch {
        // Platform may forbid opening a directory; the data sync already happened.
      }
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if ((code === "EPERM" || code === "EBUSY") && i < delays.length) {
        await new Promise((r) => setTimeout(r, delays[i]));
        continue;
      }
      try { await fs.unlink(tmpPath); } catch { /* ignore cleanup errors */ }
      throw new IntentError(ErrorCodes.E_IO, `Atomic write failed: ${code}`);
    }
  }
}
