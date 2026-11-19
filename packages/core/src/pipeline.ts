import { StoragePort, LockPort } from "./ports.js";
import { ErrorCodes } from "./error.js";
import { Patch } from "@intent/schema";
import { applyPatch } from "./patch.js";

/**
 * writePipeline: trd 9.2 scene lock -> object locks -> pre-batch snapshot checks ->
 * apply ALL patches to a working copy -> one atomic write. All-or-nothing:
 * a failure at any step persists nothing. The client's baseRevision is the
 * PRE-BATCH revision (trd 6.3) — in-batch writes never feed back into the checks.
 */
export async function writePipeline(
  storage: StoragePort,
  lockPort: LockPort,
  sceneId: string,
  patches: Patch[],
  expectedContent?: Record<string, string>
): Promise<{
  success: boolean;
  revision: number;
  error?: string;
  details?: { changedObjectIds: string[] };
}> {
  const sceneLockAcquired = await lockPort.acquireSceneLock(sceneId);
  if (!sceneLockAcquired) {
    return { success: false, revision: -1, error: ErrorCodes.E_LOCKED };
  }

  // Pre-batch snapshot — the only reference for consistency checks (trd 6.3).
  const scene = await storage.readScene(sceneId);
  if (!scene) {
    await lockPort.releaseSceneLock(sceneId);
    return { success: false, revision: -1, error: ErrorCodes.E_NOT_FOUND };
  }

  const acquiredPatchLocks: string[] = [];
  try {
    for (const patch of patches) {
      const acquired = await lockPort.acquire(sceneId, patch.objectId);
      if (!acquired) {
        for (const released of [...acquiredPatchLocks].reverse()) {
          await lockPort.release(sceneId, released);
        }
        return { success: false, revision: scene.revision, error: ErrorCodes.E_LOCKED };
      }
      acquiredPatchLocks.push(patch.objectId);

      // Ancestor locks — cycle-safe (corrupt graphs cannot loop forever); a lock
      // this batch already holds is not re-acquired (siblings share ancestors).
      const seenAncestors = new Set<string>();
      let current = scene.objects[patch.objectId]?.parentId;
      while (current) {
        if (seenAncestors.has(current)) {
          for (const released of [...acquiredPatchLocks].reverse()) {
            await lockPort.release(sceneId, released);
          }
          return { success: false, revision: scene.revision, error: ErrorCodes.E_INVALID_SCENE };
        }
        seenAncestors.add(current);
        if (acquiredPatchLocks.includes(current)) {
          current = scene.objects[current]?.parentId;
          continue;
        }
        const ancestorAcquired = await lockPort.acquire(sceneId, current);
        if (!ancestorAcquired) {
          for (const released of [...acquiredPatchLocks].reverse()) {
            await lockPort.release(sceneId, released);
          }
          return { success: false, revision: scene.revision, error: ErrorCodes.E_LOCKED };
        }
        acquiredPatchLocks.push(current);
        current = scene.objects[current]?.parentId;
      }

      // Descendant locks (a writer may not move a subtree under a locked node).
      const lockedObjects = await lockPort.getLockedObjects(sceneId);
      for (const lockedId of lockedObjects) {
        if (acquiredPatchLocks.includes(lockedId)) continue;
        const seenDescendants = new Set<string>();
        let ancestor = scene.objects[lockedId]?.parentId;
        while (ancestor) {
          // True cycle check — a per-locked-node visited set; a global size cap
          // could be exhausted by unrelated walks and silently skip the check.
          if (seenDescendants.has(ancestor)) break;
          seenDescendants.add(ancestor);
          if (ancestor === patch.objectId) {
            for (const released of [...acquiredPatchLocks].reverse()) {
              await lockPort.release(sceneId, released);
            }
            return { success: false, revision: scene.revision, error: ErrorCodes.E_LOCKED };
          }
          ancestor = scene.objects[ancestor]?.parentId;
        }
      }
    }

    // The scene lock serializes every writer, so the pre-batch snapshot IS the
    // current state. (The pipeline previously re-read the scene here as a
    // belt-and-braces check; measured cost ~30-50 ms per op on Windows and the
    // lock makes the interleaving it guarded against structurally impossible.)
    // The baseRevision conflict gate below is the real drift check.

    // Consistency checks against the PRE-BATCH snapshot, then apply to a working copy.
    let working = scene;
    for (const patch of patches) {
      // trd 6.3: no touched object may have changed since the client's snapshot.
      // Scoped to this patch's own target — unrelated patches in the same batch
      // carry the same pre-batch baseRevision and must not cross-flag.
      const targetObj = scene.objects[patch.objectId];
      const targetRev = targetObj ? targetObj.rev ?? scene.revision : scene.revision;
      const changedObjectIds = targetRev > patch.baseRevision ? [patch.objectId] : [];
      if (patch.baseRevision !== scene.revision || changedObjectIds.length > 0) {
        return {
          success: false,
          revision: scene.revision,
          error: ErrorCodes.E_CONFLICT,
          details: { changedObjectIds },
        };
      }
      if (expectedContent && patch.objectId in expectedContent) {
        const currentObj = scene.objects[patch.objectId];
        const expected = expectedContent[patch.objectId];
        const currentContent = currentObj?.props?.content as string | undefined;
        if (currentContent !== expected) {
          return {
            success: false,
            revision: scene.revision,
            error: ErrorCodes.E_CONFLICT,
          };
        }
      }
      if (!scene.objects[patch.objectId]) {
        return {
          success: false,
          revision: scene.revision,
          error: ErrorCodes.E_NOT_FOUND,
        };
      }
      working = applyPatch(working, patch);
    }

    await storage.writeScene(sceneId, working);
    return { success: true, revision: working.revision, details: { changedObjectIds: [] } };
  } catch (err) {
    // Intended-failure modes (corrupt scene on disk, schema-rejected working
    // copy) must never escape as exceptions — callers rely on the documented
    // {success:false} contract. Locks are still released by `finally`.
    const code = (err as { code?: unknown })?.code;
    const isIntentError = typeof code === "string" && /^E_[A-Z_]+$/.test(code);
    const isZod = (err as { name?: unknown })?.name === "ZodError";
    return {
      success: false,
      revision: scene.revision,
      error: isIntentError ? (code as string) : isZod ? ErrorCodes.E_SCHEMA : ErrorCodes.E_INTERNAL,
    };
  } finally {
    // Release the object locks this batch acquired, then the scene lock.
    for (const released of [...acquiredPatchLocks].reverse()) {
      await lockPort.release(sceneId, released);
    }
    await lockPort.releaseSceneLock(sceneId);
  }
}
