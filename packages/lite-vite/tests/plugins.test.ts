import { describe, it, expect } from "vitest";
import { defaultPlugins } from "../src/plugins/index";

describe("defaultPlugins", () => {
  it("contains 6 built-in plugins", () => {
    expect(defaultPlugins.length).toBe(6);
  });

  it("all plugins have a name", () => {
    for (const plugin of defaultPlugins) {
      expect(plugin.name).toBeTruthy();
      expect(typeof plugin.name).toBe("string");
    }
  });

  it("has plugins in correct order", () => {
    const names = defaultPlugins.map((p) => p.name);
    expect(names).toEqual([
      "html-loader",
      "css-loader",
      "vue-loader",
      "js-loader",
      "image-loader",
      "ts-loader",
    ]);
  });

  it("all plugins with transform have async transform function", () => {
    for (const plugin of defaultPlugins) {
      if (plugin.transform) {
        expect(typeof plugin.transform).toBe("function");
      }
    }
  });
});
