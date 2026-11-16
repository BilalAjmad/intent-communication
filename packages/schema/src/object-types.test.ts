import { describe, it, expect } from "vitest";
import { CheckboxSchema, RadioSchema, SwitchSchema, LinkSchema, ListSchema, ModalSchema, IconSchema, DividerSchema } from "./index";

// M2.A object type family — extracted from index.test.ts (line budget).
  describe("CheckboxSchema / RadioSchema / SwitchSchema", () => {
    const base = {
      id: "o_01ARZ3NDEKTSV4RRFFQ69G5FAV",
      parentId: "o_01ARZ3NDEKTSV4RRFFQ69G5FAV",
      children: [],
      style: {},
      meta: {},
    };
    it("validates checkbox with defaults", () => {
      const obj = { ...base, type: "checkbox", props: {} };
      const parsed = CheckboxSchema.parse(obj);
      expect(parsed.props.label).toBe("Checkbox");
      expect(parsed.props.checked).toBe(false);
      expect(parsed.props.disabled).toBe(false);
    });
    it("validates radio with name and value", () => {
      const obj = { ...base, type: "radio", props: { name: "plan", value: "pro", checked: true } };
      expect(RadioSchema.safeParse(obj).success).toBe(true);
    });
    it("rejects radio with oversized label", () => {
      const obj = { ...base, type: "radio", props: { label: "x".repeat(501) } };
      expect(RadioSchema.safeParse(obj).success).toBe(false);
    });
    it("validates switch and defaults checked off", () => {
      const obj = { ...base, type: "switch", props: { label: "Notifications" } };
      const parsed = SwitchSchema.parse(obj);
      expect(parsed.props.checked).toBe(false);
    });
  });

  describe("LinkSchema", () => {
    const base = {
      id: "o_01ARZ3NDEKTSV4RRFFQ69G5FAV",
      type: "link",
      parentId: "o_01ARZ3NDEKTSV4RRFFQ69G5FAV",
      children: [],
      style: {},
      meta: {},
    };
    it("validates a fragment link with default target", () => {
      const parsed = LinkSchema.parse({ ...base, props: { label: "Home", href: "#s-home" } });
      expect(parsed.props.target).toBe("_self");
    });
    it("accepts _blank target", () => {
      const parsed = LinkSchema.parse({ ...base, props: { label: "Docs", href: "#s-docs", target: "_blank" } });
      expect(parsed.props.target).toBe("_blank");
    });
    it("rejects unknown target", () => {
      expect(LinkSchema.safeParse({ ...base, props: { target: "_evil" } }).success).toBe(false);
    });
  });

  describe("ListSchema", () => {
    const base = {
      id: "o_01ARZ3NDEKTSV4RRFFQ69G5FAV",
      type: "list",
      parentId: "o_01ARZ3NDEKTSV4RRFFQ69G5FAV",
      children: [],
      style: {},
      meta: {},
    };
    it("defaults to unordered empty list", () => {
      const parsed = ListSchema.parse({ ...base, props: {} });
      expect(parsed.props.items).toEqual([]);
      expect(parsed.props.ordered).toBe(false);
    });
    it("accepts ordered list of items", () => {
      const parsed = ListSchema.parse({ ...base, props: { ordered: true, items: ["a", "b"] } });
      expect(parsed.props.ordered).toBe(true);
      expect(parsed.props.items).toHaveLength(2);
    });
    it("rejects more than 100 items", () => {
      const items = Array.from({ length: 101 }, (_, i) => `item ${i}`);
      expect(ListSchema.safeParse({ ...base, props: { items } }).success).toBe(false);
    });
  });

  describe("ModalSchema / IconSchema / DividerSchema", () => {
    const base = {
      id: "o_01ARZ3NDEKTSV4RRFFQ69G5FAV",
      parentId: "o_01ARZ3NDEKTSV4RRFFQ69G5FAV",
      children: [],
      style: {},
      meta: {},
    };
    it("modal defaults size md and closed", () => {
      const parsed = ModalSchema.parse({ ...base, type: "modal", props: {} });
      expect(parsed.props.size).toBe("md");
      expect(parsed.props.open).toBe(false);
    });
    it("rejects unknown modal size", () => {
      expect(ModalSchema.safeParse({ ...base, type: "modal", props: { size: "xxl" } }).success).toBe(false);
    });
    it("icon defaults to info/24", () => {
      const parsed = IconSchema.parse({ ...base, type: "icon", props: {} });
      expect(parsed.props.icon).toBe("info");
      expect(parsed.props.size).toBe(24);
    });
    it("rejects non-integer icon size", () => {
      expect(IconSchema.safeParse({ ...base, type: "icon", props: { size: 12.5 } }).success).toBe(false);
    });
    it("divider defaults horizontal thickness 1", () => {
      const parsed = DividerSchema.parse({ ...base, type: "divider", props: {} });
      expect(parsed.props.direction).toBe("horizontal");
      expect(parsed.props.thickness).toBe(1);
    });
  });
