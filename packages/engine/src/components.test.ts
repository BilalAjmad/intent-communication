import { describe, it, expect } from "vitest";
import type { Scene } from "@intent/schema";
import {
  expandComponentInstances,
  exportToHtml,
  exportToReact,
  normalizeScene,
} from "./index";
import { createBaseScene, createScreen } from "../tests/test-helpers";

const SCREEN = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const DEFROOT = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const DEFTEXT = "o_02ARZ3NDEKTSV4RRFFQ69G5FAV";
const INST = "o_03ARZ3NDEKTSV4RRFFQ69G5FAV";
const DEF2ROOT = "o_04ARZ3NDEKTSV4RRFFQ69G5FAV";
const NESTED_INST = "o_05ARZ3NDEKTSV4RRFFQ69G5FAV";
const TOP_INST = "o_06ARZ3NDEKTSV4RRFFQ69G5FAV";
const COMPONENT = "c_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const COMPONENT2 = "c_02ARZ3NDEKTSV4RRFFQ69G5FAV";

function skeleton() {
  return createBaseScene({
    screens: { [SCREEN]: createScreen(SCREEN, "Home", [INST, TOP_INST]) },
    objects: {} as Scene["objects"],
    components: [],
    screenOrder: [SCREEN],
  });
}

function withDef(objects: Scene["objects"], components: NonNullable<Scene["components"]>): Scene {
  const scene = skeleton();
  scene.screens[SCREEN].children = [INST];
  scene.objects = objects;
  scene.components = components;
  return scene;
}

function objectsForDef1(): Scene["objects"] {
  return {
    [SCREEN]: { ...createScreen(SCREEN, "Home", [INST]) } as Scene["objects"][string],
    [DEFROOT]: {
      id: DEFROOT, type: "container", parentId: null, children: [DEFTEXT],
      props: { layout: "flex", direction: "column", gap: 4 },
      style: { background: "#eeeeee" },
      meta: {}, states: {}, responsive: {},
    },
    [DEFTEXT]: {
      id: DEFTEXT, type: "text", parentId: DEFROOT, children: [],
      props: { content: "From def", fontSize: 16 },
      style: {}, meta: {}, states: {}, responsive: {},
    },
    [INST]: {
      id: INST, type: "container", parentId: SCREEN, children: [],
      props: {}, style: {}, meta: {}, states: {}, responsive: {},
      componentRef: { componentId: COMPONENT, overrides: {} },
    },
  } as Scene["objects"];
}

function sceneWithDef1(overrides?: {
  instProps?: Record<string, unknown>;
  instOverrides?: Record<string, unknown>;
}): Scene {
  const objects = objectsForDef1();
  const inst = { ...objects[INST] } as Scene["objects"][string] & { props: Record<string, unknown>; componentRef?: { componentId: string; overrides: Record<string, unknown> } };
  inst.props = { ...inst.props, ...overrides?.instProps };
  if (overrides?.instOverrides) {
    inst.componentRef = { componentId: COMPONENT, overrides: overrides.instOverrides };
  }
  objects[INST] = inst;
  return withDef(objects, [
    { id: COMPONENT, name: "Card", rev: 1, rootId: DEFROOT, objectIds: [DEFROOT, DEFTEXT], exposedProps: {} },
  ]);
}

describe("expandComponentInstances (trd 5.5)", () => {
  it("expands an instance into the def subtree with derived ids", () => {
    const scene = sceneWithDef1();
    const expanded = expandComponentInstances(scene);
    expect(expanded.objects[INST].children).toEqual([`${INST}::${DEFTEXT}`]);
    const inner = expanded.objects[`${INST}::${DEFTEXT}`];
    expect(inner).toBeDefined();
    expect(inner.props.content).toBe("From def");
    expect(expanded.objects[INST].props.layout).toBe("flex");
    expect(expanded.objects[INST].style.background).toBe("#eeeeee");
  });

  it("instance props win over def root props, def fills the rest", () => {
    const scene = sceneWithDef1({ instProps: { gap: 99 } });
    const expanded = expandComponentInstances(scene);
    expect(expanded.objects[INST].props.gap).toBe(99);
    expect(expanded.objects[INST].props.layout).toBe("flex");
  });

  it("override props win over everything", () => {
    const scene = sceneWithDef1({
      instProps: { gap: 99 },
      instOverrides: { [DEFTEXT]: { props: { content: "Overridden" } } },
    });
    const expanded = expandComponentInstances(scene);
    expect(expanded.objects[`${INST}::${DEFTEXT}`].props.content).toBe("Overridden");
  });

  it("override visible:false puts display:none on the target node", () => {
    const scene = sceneWithDef1({
      instOverrides: { [DEFTEXT]: { visible: false } },
    });
    const expanded = expandComponentInstances(scene);
    expect(expanded.objects[`${INST}::${DEFTEXT}`].style.display).toBe("none");
  });

  it("override for the def root applies to the instance itself", () => {
    const scene = sceneWithDef1({
      instOverrides: { [DEFROOT]: { style: { background: "#123456" } } },
    });
    const expanded = expandComponentInstances(scene);
    expect(expanded.objects[INST].style.background).toBe("#123456");
  });

  it("rejects unknown override keys with E_SCHEMA", () => {
    const scene = sceneWithDef1({
      instOverrides: { o_99ARZ3NDEKTSV4RRFFQ69G5FAV: { props: { content: "x" } } },
    });
    expect(() => expandComponentInstances(scene)).toThrow(/unknown inner node/);
  });

  it("rejects a missing component with E_SCHEMA", () => {
    const scene = sceneWithDef1();
    scene.objects[INST] = {
      ...scene.objects[INST],
      componentRef: { componentId: "c_09ARZ3NDEKTSV4RRFFQ69G5FAV", overrides: {} },
    } as Scene["objects"][string];
    expect(() => expandComponentInstances(scene)).toThrow(/missing component/);
  });

  it("rejects instance without components array entries", () => {
    const scene = sceneWithDef1();
    scene.components = [];
    expect(() => expandComponentInstances(scene)).toThrow(/declares none/);
  });

  it("nested instances nest derived ids", () => {
    const objects = objectsForDef1();
    const nested: Scene["objects"][string] = {
      id: NESTED_INST, type: "container", parentId: DEF2ROOT, children: [],
      props: {}, style: {}, meta: {}, states: {}, responsive: {},
      componentRef: { componentId: COMPONENT, overrides: {} },
    };
    objects[DEF2ROOT] = {
      id: DEF2ROOT, type: "container", parentId: null, children: [NESTED_INST],
      props: { layout: "flex", direction: "row" },
      style: {}, meta: {}, states: {}, responsive: {},
    };
    objects[NESTED_INST] = nested;
    objects[TOP_INST] = {
      id: TOP_INST, type: "container", parentId: SCREEN, children: [],
      props: {}, style: {}, meta: {}, states: {}, responsive: {},
      componentRef: { componentId: COMPONENT2, overrides: {} },
    };
    objects[SCREEN] = { ...objects[SCREEN], children: [TOP_INST] } as Scene["objects"][string];
    const scene = withDef(objects, [
      { id: COMPONENT, name: "Card", rev: 1, rootId: DEFROOT, objectIds: [DEFROOT, DEFTEXT], exposedProps: {} },
      { id: COMPONENT2, name: "Panel", rev: 1, rootId: DEF2ROOT, objectIds: [DEF2ROOT, NESTED_INST], exposedProps: {} },
    ]);
    scene.screens[SCREEN].children = [TOP_INST];
    const expanded = expandComponentInstances(scene);
    expect(expanded.objects[`${TOP_INST}::${NESTED_INST}`]).toBeDefined();
    expect(expanded.objects[`${TOP_INST}::${NESTED_INST}::${DEFTEXT}`]).toBeDefined();
    expect(expanded.objects[`${TOP_INST}::${NESTED_INST}::${DEFTEXT}`].props.content).toBe("From def");
  });

  it("exportToHtml renders the def content for an instance", () => {
    const scene = sceneWithDef1();
    const html = exportToHtml(scene);
    expect(html).toContain("From def");
    expect(html).toContain(`data-object-id="${INST}::${DEFTEXT}"`);
  });

  it("exportToReact renders the def content for an instance", () => {
    const scene = sceneWithDef1();
    const files = exportToReact(scene, { includeDataIds: true });
    const screenFile = files["intent-export/screens/Home.tsx"];
    expect(screenFile).toContain("From def");
    expect(screenFile).toContain(`data-object-id={${JSON.stringify(`${INST}::${DEFTEXT}`)}}`);
  });

  it("normalizeScene preserves componentRef and components", () => {
    const scene = sceneWithDef1();
    const result = normalizeScene(scene, { applyDefaults: true });
    expect(result.scene.components).toHaveLength(1);
    expect(result.scene.objects[INST].componentRef?.componentId).toBe(COMPONENT);
  });

  it("expansion does not mutate the input scene", () => {
    const scene = sceneWithDef1();
    const before = JSON.stringify(scene);
    expandComponentInstances(scene);
    expect(JSON.stringify(scene)).toBe(before);
  });
});
