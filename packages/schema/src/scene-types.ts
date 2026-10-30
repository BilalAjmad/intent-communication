/**
 * M1 Scene and Object Types (trd 5.1-5.4)
 * Core scene graph types for the Intent system.
 */

export type ObjectType = 'frame' | 'text' | 'image' | 'vector' | 'component'

export interface SceneObject {
  id: string
  type: ObjectType
  parentId: string
  rect: { x: number; y: number; width: number; height: number }
  children: string[]
  props: Record<string, unknown>
}

export interface Scene {
  id: string
  version: number
  rootId: string
  objects: SceneObject[]
  locks: Lock[]
}

export interface Lock {
  objectId: string
  lockedBy: string
  timestamp: number
}

export const OBJECT_TYPES: ObjectType[] = ['frame', 'text', 'image', 'vector', 'component']

export function isValidObjectType(type: string): type is ObjectType {
  return ['frame', 'text', 'image', 'vector', 'component'].includes(type)
}

export function createScene(): Scene {
  const rootId = `frame_${Date.now().toString(36)}`
  return {
    id: `scene_${Date.now().toString(36)}`,
    version: 0,
    rootId,
    objects: [{
      id: rootId,
      type: 'frame',
      parentId: 'scene_root',
      rect: { x: 0, y: 0, width: 1920, height: 1080 },
      children: [],
      props: {},
    }],
    locks: [],
  }
}

export function validateScene(scene: Scene): boolean {
  // Check required fields
  if (!scene.id || !scene.rootId || !Array.isArray(scene.objects) || !Array.isArray(scene.locks)) {
    return false
  }

  // Check for duplicate IDs
  const ids = new Set<string>()
  for (const obj of scene.objects) {
    if (ids.has(obj.id)) return false
    ids.add(obj.id)
  }

  // Check root exists
  const root = scene.objects.find(o => o.id === scene.rootId)
  if (!root || root.type !== 'frame') return false

  // Check all parent references exist
  const idSet = new Set(scene.objects.map(o => o.id))
  idSet.add('scene_root')
  for (const obj of scene.objects) {
    if (!idSet.has(obj.parentId)) return false
  }

  // Check for cycles in parent chain
  for (const obj of scene.objects) {
    let current = obj.parentId
    const visited = new Set<string>()
    while (current !== 'scene_root') {
      if (visited.has(current)) return false
      visited.add(current)
      const parent = scene.objects.find(o => o.id === current)
      if (!parent) return false
      current = parent.parentId
    }
  }

  // Check for cycles in children hierarchy
  for (const obj of scene.objects) {
    const visited = new Set<string>()
    const stack = [...obj.children]
    while (stack.length > 0) {
      const current = stack.pop()!
      if (visited.has(current)) return false
      visited.add(current)
      const child = scene.objects.find(o => o.id === current)
      if (child) {
        stack.push(...child.children)
      }
    }
  }

  return true
}