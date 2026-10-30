/**
 * Hashing Helpers
 * Deterministic hashing for scenes and objects.
 */

export function hashScene(scene: any): string {
  const str = JSON.stringify(scene, Object.keys(scene).sort())
  return hashString(str)
}

export function hashObject(obj: any): string {
  const str = JSON.stringify(obj, Object.keys(obj).sort())
  return hashString(str)
}

function hashString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}