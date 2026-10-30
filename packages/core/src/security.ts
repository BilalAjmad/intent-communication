/**
 * Security Checks (trd 6.3, 9.2)
 * Path whitelist, scope escape, lock inheritance checks.
 */

import { Scene } from '@intent/schema'

export function checkPathWhitelist(path: string): boolean {
  // Only allow paths under .intent/
  if (!path.startsWith('.intent/')) return false
  // Reject absolute paths
  if (path.startsWith('/') || /^[A-Za-z]:\\/.test(path)) return false
  // Reject directory traversal
  if (path.includes('..')) return false
  return true
}

export function checkScopeEscape(scene: any, objectId: string, newParentId: string): boolean {
  // Check if moving objectId to newParentId would escape its current subtree
  const object = scene.objects[objectId]
  const newParent = scene.objects[newParentId]
  if (!object || !newParent) return true // Invalid objects = escape

  // If newParent is ancestor of object, it's NOT an escape (moving up)
  // If object is ancestor of newParent, it's an escape (moving down outside)
  // Actually: escape = newParent is NOT in object's subtree AND newParent is not an ancestor
  
  // Simplified: check if newParent is in object's subtree
  let current = newParent
  while (current && current.id !== 'scene_root') {
    if (current.id === objectId) return true // newParent is in object's subtree = escape
    current = scene.objects[current.parentId]
  }
  return false
}

export function checkMoveOutOfSubtree(scene: any, objectId: string, newParentId: string): boolean {
  // Similar to scope escape but for move operation specifically
  // Check if moving objectId under newParentId would place it outside its original subtree
  const object = scene.objects[objectId]
  const newParent = scene.objects[newParentId]
  if (!object || !newParent) return true

  // Find object's original root ancestor
  let current = scene.objects[objectId]
  while (current && current.parentId !== 'scene_root') {
    current = scene.objects[current.parentId]
  }
  const originalRoot = current

  // Find newParent's root ancestor
  current = scene.objects[newParentId]
  while (current && current.parentId !== 'scene_root') {
    current = scene.objects[current.parentId]
  }
  const newRoot = current

  // If roots differ, it's a subtree escape
  return originalRoot !== newRoot
}

export function checkRemoveWithLockedDescendant(scene: any, objectId: string): boolean {
  // Check if objectId or any descendant is locked
  const locks = new Set(scene.locks?.map((l: any) => l.objectId) || [])
  
  // Check object itself
  if (locks.has(objectId)) return true

  // Check descendants
  const queue = [objectId]
  while (queue.length > 0) {
    const currentId = queue.shift()!
    const obj = scene.objects[currentId]
    if (!obj) continue
    for (const childId of obj.children) {
      if (locks.has(childId)) return true
      queue.push(childId)
    }
  }
  return false
}

export function checkLockInheritance(scene: { objects: Record<string, any>; locks: any[] }, objectId: string): boolean {
  // Check if object or any ancestor is locked
  const locks = new Set(scene.locks?.map((l: any) => l.objectId) || [])
  
  let current = scene.objects[objectId]
  while (current) {
    if (locks.has(current.id)) return true
    if (current.parentId === 'scene_root') break
    current = scene.objects[current.parentId]
  }
  return false
}