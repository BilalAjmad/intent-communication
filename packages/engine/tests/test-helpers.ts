import type { Scene, SceneObject, Screen } from "@intent/schema";

type Container = SceneObject & { type: "container"; props: { layout?: "flex" | "grid" | "absolute"; gap?: number; padding?: number; direction?: "row" | "column"; align?: "start" | "center" | "end" | "stretch"; justify?: "start" | "center" | "end" | "space-between" | "space-around" } };
type Text = SceneObject & { type: "text"; props: { content: string; fontSize?: number } };
type Button = SceneObject & { type: "button"; props: { label: string; variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive" } };
type Image = SceneObject & { type: "image"; props: { src: string; alt?: string; fit?: "cover" | "contain" | "fill" | "scale-down" | "none" } };

// Shared test fixtures for engine tests (not shipped — excluded from the
// published build).
export function createBaseScene(overrides: Partial<Scene> = {}): Scene {
  return {
    version: 1,
    revision: 1,
    createdAt: "2026-11-02T22:38:00.000Z",
    updatedAt: "2026-11-02T22:38:00.000Z",
    screens: {},
    objects: {},
    screenOrder: [],
    metadata: { name: "Test", tags: [] },
    ...overrides,
  };
}

export function createScreen(id: string, title: string = "Test Screen", children: string[] = []): Screen {
  return {
    id,
    type: "screen",
    parentId: null,
    children,
    props: { title, width: 1280, height: 720 },
    style: {},
    meta: {},
  };
}

export function createContainer(id: string, parentId: string | null, children: string[] = []): Container {
  return {
    id,
    type: "container",
    parentId,
    children,
    props: { layout: "flex", direction: "column" },
    style: {},
    meta: {},
  };
}

export function createText(id: string, parentId: string, content: string): Text {
  return {
    id,
    type: "text",
    parentId,
    children: [],
    props: { content, fontSize: 16 },
    style: {},
    meta: {},
  };
}

export function createButton(id: string, parentId: string, label: string): Button {
  return {
    id,
    type: "button",
    parentId,
    children: [],
    props: { label, variant: "primary" },
    style: { minWidth: 44, minHeight: 44 },
    meta: {},
  };
}

export function createImage(id: string, parentId: string, src: string): Image {
  return {
    id,
    type: "image",
    parentId,
    children: [],
    props: { src, alt: "Test image", fit: "cover" },
    style: {},
    meta: {},
  };
}
