import { StoragePort, LockPort } from "./ports.js";
import { ErrorCodes } from "./error.js";
import { Patch } from "@intent/schema";
import { applyPatch } from "./patch.js";

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
  // Scene-level write lock: trd 9.2 single write lock for the whole scene
  const sceneLockAcquired = await lockPort.acquireSceneLock(sceneId);
  if (!sceneLockAcquired) {
    return { success: false, revision: -1, error: ErrorCodes.E_LOCKED };
  }

  // Acquire object-level locks for touched objects (handles stale locks from dead processes)
  const acquiredPatchLocks: string[] = [];
  try {
    const scene = await storage.readScene(sceneId);
    if (!scene) {
      return { success: false, revision: -1, error: ErrorCodes.E_NOT_FOUND };
    }

    for (const patch of patches) {
      const acquired = await lockPort.acquire(sceneId, patch.objectId);
      if (!acquired) {
        // Release any locks acquired so far in this batch
        for (const released of acquiredPatchLocks.reverse()) {
          await lockPort.release(sceneId, released);
        }
        return { success: false, revision: scene.revision, error: ErrorCodes.E_LOCKED };
      }
      acquiredPatchLocks.push(patch.objectId);
      // Check ancestor locks (going up from patch object)
      let current = scene.objects[patch.objectId]?.parentId;
      while (current) {
        const ancestorAcquired = await lockPort.acquire(sceneId, current);
        if (!ancestorAcquired) {
          // Release locks acquired so far
          for (const released of [...acquiredPatchLocks, current].reverse()) {
            await lockPort.release(sceneId, released);
          }
          return { success: false, revision: scene.revision, error: ErrorCodes.E_LOCKED };
        }
        acquiredPatchLocks.push(current);
        current = scene.objects[current]?.parentId;
      }
      // Check descendant locks (going down: any locked object whose ancestor is patch.objectId)
      const lockedObjects = await lockPort.getLockedObjects(sceneId);
      for (const lockedId of lockedObjects) {
        let ancestor = scene.objects[lockedId]?.parentId;
        while (ancestor) {
          if (ancestor === patch.objectId) {
            // Descendant is locked - release all and fail
            for (const released of acquiredPatchLocks.reverse()) {
              await lockPort.release(sceneId, released);
            }
            return { success: false, revision: scene.revision, error: ErrorCodes.E_LOCKED };
          }
          ancestor = scene.objects[ancestor]?.parentId;
        }
      }
    }

    let currentScene = scene;
    for (const patch of patches) {
      // baseRevision check (always enforced): client snapshot must be current, and no
      // touched object may have been modified after the client's snapshot (trd 6.3)
      const changedObjectIds: string[] = [];
      for (const other of patches) {
        const obj = currentScene.objects[other.objectId];
        if (!obj) continue;
        const objRev = obj.rev ?? currentScene.revision;
        if (objRev > patch.baseRevision) {
          changedObjectIds.push(other.objectId);
        }
      }

      if (patch.baseRevision !== currentScene.revision || changedObjectIds.length > 0) {
        return {
          success: false,
          revision: currentScene.revision,
          error: ErrorCodes.E_CONFLICT,
          details: { changedObjectIds },
        };
      }
      // expectedContent is an additional check: the specific object's content must match
      if (expectedContent && patch.objectId in expectedContent) {
        const currentObj = currentScene.objects[patch.objectId];
        const expected = expectedContent[patch.objectId];
        const currentContent = currentObj?.props?.content as string | undefined;
        if (currentContent !== expected) {
          return {
            success: false,
            revision: currentScene.revision,
            error: ErrorCodes.E_CONFLICT,
          };
        }
      }
      // Object existence check (scope rule)
      if (!currentScene.objects[patch.objectId]) {
        return {
          success: false,
          revision: currentScene.revision,
          error: ErrorCodes.E_NOT_FOUND,
        };
      }

      // Verify-before-write: prevent lost writes from concurrent modifications
      const verifyScene = await storage.readScene(sceneId);
      if (!verifyScene || verifyScene.revision !== currentScene.revision) {
        return {
          success: false,
          revision: verifyScene?.revision ?? currentScene.revision,
          error: ErrorCodes.E_CONFLICT,
        };
      }

      const newScene = applyPatch(currentScene, patch);
      await storage.writeScene(sceneId, newScene);
      currentScene = newScene;
    }

    const finalScene = await storage.readScene(sceneId);
    return { success: true, revision: finalScene?.revision ?? currentScene.revision };
  } finally {
    // Release object locks acquired during this writePipeline call
    for (const released of acquiredPatchLocks.reverse()) {
      await lockPort.release(sceneId, released);
    }
    // Release the trd 9.2 scene lock
    await lockPort.releaseSceneLock(sceneId);
  }
}
