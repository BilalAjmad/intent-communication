import { describe, it, expect } from "vitest";
import type { Scene } from "@intent/schema";
import { normalizeSceneToModel } from "./index";
import { createBaseScene, createScreen, createContainer } from "../tests/test-helpers";

const SCREEN_A = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const SCREEN_B = "s_02ARZ3NDEKTSV4RRFFQ69G5FAV";
const CONT = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const TEXT = "o_02ARZ3NDEKTSV4RRFFQ69G5FAV";
const BUTTON = "o_03ARZ3NDEKTSV4RRFFQ69G5FAV";
const CHECK = "o_04ARZ3NDEKTSV4RRFFQ69G5FAV";
const LINK = "o_05ARZ3NDEKTSV4RRFFQ69G5FAV";
const LIST = "o_06ARZ3NDEKTSV4RRFFQ69G5FAV";
const MODAL = "o_07ARZ3NDEKTSV4RRFFQ69G5FAV";
const ICON = "o_08ARZ3NDEKTSV4RRFFQ69G5FAV";
const DIVIDER = "o_09ARZ3NDEKTSV4RRFFQ69G5FAV";
const INPUT = "o_0AARZ3NDEKTSV4RRFFQ69G5FAV";
const IMAGE = "o_0BARZ3NDEKTSV4RRFFQ69G5FAV";
const COMPONENT = "c_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const DEFROOT = "o_0CARZ3NDEKTSV4RRFFQ69G5FAV";
const DEFTEXT = "o_0DARZ3NDEKTSV4RRFFQ69G5FAV";
const INST = "o_0EARZ3NDEKTSV4RRFFQ69G5FAV";

function baseScene(): Scene {
  return createBaseScene({
    screens: {
      [SCREEN_A]: createScreen(SCREEN_A, "Home", [CONT]),
      [SCREEN_B]: createScreen(SCREEN_B, "Done", []),
    },
    objects: {
      [SCREEN_A]: createScreen(SCREEN_A, "Home", [CONT]),
      [SCREEN_B]: createScreen(SCREEN_B, "Done", []),
      [CONT]: createContainer(CONT, SCREEN_A, [TEXT, BUTTON, INPUT, IMAGE, CHECK, LINK, LIST, MODAL, ICON, DIVIDER]),
      [TEXT]: {
        id: TEXT, type: "text", parentId: CONT, children: [],
        props: { content: "Hello <b>", fontSize: 18 }, style: { color: "token.color.text-primary" }, meta: {},
      },
      [BUTTON]: {
        id: BUTTON, type: "button", parentId: CONT, children: [],
        props: { label: "Ship it", variant: "outline", size: "md", disabled: true },
        style: {}, meta: {}, states: { loading: { style: { opacity: 0.6 } } },
      },
      [INPUT]: {
        id: INPUT, type: "input", parentId: CONT, children: [],
        props: { type: "email", placeholder: "Email", required: true }, style: {}, meta: {},
      },
      [IMAGE]: {
        id: IMAGE, type: "image", parentId: CONT, children: [],
        props: { src: "https://example.com/x.png", alt: "chart", fit: "cover" }, style: {}, meta: {},
      },
      [CHECK]: {
        id: CHECK, type: "checkbox", parentId: CONT, children: [],
        props: { label: "I agree", checked: true, name: "agree" }, style: {}, meta: {},
      },
      [LINK]: {
        id: LINK, type: "link", parentId: CONT, children: [],
        props: { label: "Home", href: "https://evil.example.com", target: "_blank" }, style: {}, meta: {},
      },
      [LIST]: {
        id: LIST, type: "list", parentId: CONT, children: [],
        props: { ordered: true, items: ["<script>bad()</script>", "plain"] }, style: {}, meta: {},
      },
      [MODAL]: {
        id: MODAL, type: "modal", parentId: CONT, children: [],
        props: { title: "Confirm", size: "sm", open: true }, style: {}, meta: {},
      },
      [ICON]: {
        id: ICON, type: "icon", parentId: CONT, children: [],
        props: { icon: "warning", size: 24, label: "Careful" }, style: {}, meta: {},
      },
      [DIVIDER]: {
        id: DIVIDER, type: "divider", parentId: CONT, children: [],
        props: { direction: "vertical", thickness: 2 }, style: {}, meta: {},
      },
    },
    components: [],
    screenOrder: [SCREEN_A, SCREEN_B],
  } as never);
}

describe("normalizeSceneToModel (trd 13.1/13.2)", () => {
  it("produces a deterministic model with screen order and title", () => {
    const a = normalizeSceneToModel(baseScene());
    const b = normalizeSceneToModel(baseScene());
    expect(a).toEqual(b);
    expect(a.formatVersion).toBe(1);
    expect(a.title).toBe("Test");
    expect(a.startScreenId).toBe(SCREEN_A);
    expect(a.screens.map((s) => s.id)).toEqual([SCREEN_A, SCREEN_B]);
    expect(a.vars.light["--intent-color-primary"]).toBe("#0066cc");
    expect(a.vars.dark["--intent-color-background"]).toBe("#1a1a2e");
    expect(a.breakpoints).toEqual({ sm: 640, md: 1024, lg: 1440 });
  });

  it("maps text, button, input and image with allowlisted attributes and classes", () => {
    const model = normalizeSceneToModel(baseScene());
    const home = model.screens[0];
    const cont = home.root.children[0];
    expect(cont.tag).toBe("div");
    expect(cont.attrs.class).toBe("intent-container");
    const [text, button, input, image] = cont.children;
    expect(text.tag).toBe("p");
    expect(text.text).toBe("Hello <b>");
    expect(text.style?.color).toBe("var(--intent-color-text-primary)");
    expect(button.tag).toBe("button");
    expect(button.attrs.type).toBe("button");
    expect(button.attrs.disabled).toBe("");
    expect(button.attrs.class).toContain("intent-button-outline");
    expect(button.text).toBe("Ship it");
    expect(button.states.loading?.["opacity"]).toBe("0.6");
    expect(input.attrs.type).toBe("email");
    expect(input.attrs.placeholder).toBe("Email");
    expect(input.attrs.required).toBe("");
    expect(input.attrs["aria-label"]).toBe("Email");
    expect(image.attrs.src).toBe(""); // external URL dropped (trd rule 8)
    expect(image.attrs.alt).toBe("chart");
  });

  it("checkbox renders as label with input + span children", () => {
    const model = normalizeSceneToModel(baseScene());
    const cont = model.screens[0].root.children[0];
    const checkbox = cont.children[4];
    expect(checkbox.tag).toBe("label");
    expect(checkbox.attrs.class).toBe("intent-checkbox");
    expect(checkbox.children).toHaveLength(2);
    expect(checkbox.children[0].tag).toBe("input");
    expect(checkbox.children[0].attrs.type).toBe("checkbox");
    expect(checkbox.children[0].attrs.name).toBe("agree");
    expect(checkbox.children[0].attrs.checked).toBe("checked");
    expect(checkbox.children[1].tag).toBe("span");
    expect(checkbox.children[1].text).toBe("I agree");
  });

  it("link keeps fragment hrefs, drops absolute URLs, forces noopener on _blank", () => {
    const model = normalizeSceneToModel(baseScene());
    const cont = model.screens[0].root.children[0];
    const link = cont.children[5];
    expect(link.tag).toBe("a");
    expect(link.attrs.href).toBeUndefined(); // stripped per trd rule 8
    expect(link.attrs.target).toBe("_blank");
    expect(link.attrs.rel).toBe("noopener");
    expect(link.text).toBe("Home");
  });

  it("list items are escaped data, ordered list uses <ol>", () => {
    const model = normalizeSceneToModel(baseScene());
    const cont = model.screens[0].root.children[0];
    const list = cont.children[6];
    expect(list.tag).toBe("ol");
    expect(list.children[0].text).toBe("<script>bad()</script>");
    expect(list.children[0].tag).toBe("li");
  });

  it("modal carries open attribute, aria-label and an h2 title node", () => {
    const model = normalizeSceneToModel(baseScene());
    const cont = model.screens[0].root.children[0];
    const modal = cont.children[7];
    expect(modal.tag).toBe("dialog");
    expect(modal.attrs.open).toBe("");
    expect(modal.attrs["aria-label"]).toBe("Confirm");
    expect(modal.attrs.class).toBe("intent-modal intent-modal-sm");
    expect(modal.children[0]?.tag).toBe("h2");
    expect(modal.children[0]?.text).toBe("Confirm");
  });

  it("icon carries data-icon, role and aria-label", () => {
    const model = normalizeSceneToModel(baseScene());
    const cont = model.screens[0].root.children[0];
    const icon = cont.children[8];
    expect(icon.attrs["data-icon"]).toBe("warning");
    expect(icon.attrs["role"]).toBe("img");
    expect(icon.attrs["aria-label"]).toBe("Careful");
    expect(icon.attrs.class).toBe("intent-icon");
  });

  it("divider renders as <hr role=separator>", () => {
    const model = normalizeSceneToModel(baseScene());
    const cont = model.screens[0].root.children[0];
    const divider = cont.children[9];
    expect(divider.tag).toBe("hr");
    expect(divider.attrs.role).toBe("separator");
    expect(divider.attrs.class).toBe("intent-divider intent-divider-vertical");
  });

  it("instance components expand with derived ids and theme vars present", () => {
    const scene = baseScene();
    scene.components = [
      { id: COMPONENT, name: "Card", rev: 1, rootId: DEFROOT, objectIds: [DEFROOT, DEFTEXT], exposedProps: {} },
    ];
    scene.objects[DEFROOT] = {
      id: DEFROOT, type: "container", parentId: null, children: [DEFTEXT],
      props: { layout: "flex", direction: "column" }, style: {}, meta: {},
    } as never;
    scene.objects[DEFTEXT] = {
      id: DEFTEXT, type: "text", parentId: DEFROOT, children: [],
      props: { content: "From def", fontSize: 16 }, style: {}, meta: {},
    } as never;
    scene.objects[INST] = {
      id: INST, type: "container", parentId: SCREEN_A, children: [],
      props: {}, style: {}, meta: {},
      componentRef: { componentId: COMPONENT, overrides: {} },
    } as never;
    scene.screens[SCREEN_A].children = [INST];
    scene.objects[SCREEN_A] = { ...scene.objects[SCREEN_A], children: [INST] } as never;
    scene.screenOrder = [SCREEN_A];
    const model = normalizeSceneToModel(scene);
    const instNode = model.screens[0].root.children[0];
    expect(instNode.tag).toBe("div");
    expect(instNode.children).toHaveLength(1);
    expect(instNode.children[0].id).toBe(`${INST}::${DEFTEXT}`);
    expect(instNode.children[0].text).toBe("From def");
  });
});
